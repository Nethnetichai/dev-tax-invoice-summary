import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Upload, BarChart3, Download, Calendar, Search, Filter } from 'lucide-react'
import { parseShopeeExcel, exportToExcel } from './utils/excelUtils'
import { generateInvoicePDF, generateTaxSummaryPDF, generateBulkInvoicesPDF } from './utils/invoiceUtils'
import { supabase } from './lib/supabaseClient'
import SummaryTable from './components/SummaryTable'
import AnalyticsCharts from './components/AnalyticsCharts'
import './App.css'

function App() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  
  const [startDateInput, setStartDateInput] = useState('')
  const [endDateInput, setEndDateInput] = useState('')
  const [searchTermInput, setSearchTermInput] = useState('')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showData, setShowData] = useState(true)

  // Fetch ALL data from Supabase (no row limit) using pagination
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        let allData = []
        let from = 0
        const pageSize = 1000
        
        while (true) {
          const { data: pageData, error } = await supabase
            .from('tax_invoices')
            .select('*')
            .order('orderDate', { ascending: false })
            .range(from, from + pageSize - 1)
          
          if (error) throw error
          if (!pageData || pageData.length === 0) break
          
          allData = [...allData, ...pageData]
          
          if (pageData.length < pageSize) break // Last page
          from += pageSize
        }
        
        // Migration for missing invoiceNo
        const missingInvoice = allData.filter(item => !item.invoiceNo);
        if (missingInvoice.length > 0) {
          let maxRunning = 0;
          const orderInvoiceMap = {};
          
          allData.forEach(row => {
            if (row.invoiceNo) {
              orderInvoiceMap[row.orderId] = row.invoiceNo;
              const parts = row.invoiceNo.split('-');
              if (parts.length === 2) {
                const num = parseInt(parts[1], 10);
                if (!isNaN(num) && num > maxRunning) maxRunning = num;
              }
            }
          });

          const uniqueMissingOrders = [...new Set(missingInvoice.map(item => item.orderId))];
          uniqueMissingOrders.sort((a, b) => {
            const dateA = new Date(missingInvoice.find(i => i.orderId === a).orderDate);
            const dateB = new Date(missingInvoice.find(i => i.orderId === b).orderDate);
            return dateA - dateB;
          });

          uniqueMissingOrders.forEach(orderId => {
            if (!orderInvoiceMap[orderId]) {
              maxRunning++;
              const orderDateStr = missingInvoice.find(i => i.orderId === orderId).orderDate;
              const datePart = orderDateStr ? orderDateStr.split(' ')[0].replace(/-/g, '') : '20260101';
              orderInvoiceMap[orderId] = `${datePart}-${String(maxRunning).padStart(4, '0')}`;
            }
          });

          // Update database
          const recordsToUpdate = allData.filter(item => !item.invoiceNo).map(item => ({
            ...item,
            invoiceNo: orderInvoiceMap[item.orderId]
          }));

          const chunkSize = 100;
          for (let i = 0; i < recordsToUpdate.length; i += chunkSize) {
            const batch = recordsToUpdate.slice(i, i + chunkSize);
            const batchOrderIds = [...new Set(batch.map(item => item.orderId))];
            
            await supabase.from('tax_invoices').delete().in('orderId', batchOrderIds);
            await supabase.from('tax_invoices').insert(batch);
          }

          allData = allData.map(item => ({
            ...item,
            invoiceNo: item.invoiceNo || orderInvoiceMap[item.orderId]
          }));
        }

        setData(allData)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const saveToSupabase = async (parsedData) => {
    try {
      const { data: existingData } = await supabase.from('tax_invoices').select('orderId, invoiceNo, orderDate');
      
      const existingInvoices = {};
      let maxRunning = 0;
      let maxDateObj = new Date(0);
      
      if (existingData) {
        existingData.forEach(row => {
          if (row.invoiceNo) {
            existingInvoices[row.orderId] = row.invoiceNo;
            const parts = row.invoiceNo.split('-');
            if (parts.length === 2) {
              const num = parseInt(parts[1], 10);
              if (!isNaN(num) && num > maxRunning) maxRunning = num;
            }
            if (row.orderDate) {
              const rowDate = new Date(row.orderDate.split(' ')[0]);
              if (rowDate > maxDateObj) maxDateObj = rowDate;
            }
          }
        });
      }

      const orderInvoiceMap = { ...existingInvoices };
      
      // Sort new orders by date to assign sequential numbers
      const sortedNewData = [...parsedData].sort((a, b) => new Date(a.orderDate) - new Date(b.orderDate));
      
      // Chronological Check
      const hasOlderDate = sortedNewData.some(item => {
         if (!existingInvoices[item.orderId] && item.orderDate) {
            const itemDate = new Date(item.orderDate.split(' ')[0]);
            return itemDate < maxDateObj;
         }
         return false;
      });

      if (hasOlderDate) {
         const proceed = window.confirm("คำเตือน: ข้อมูลที่อัปโหลดมีวันที่เก่ากว่าเอกสารล่าสุดที่ออกไปแล้ว\n\nหากดำเนินการต่อ เลขที่เอกสารจะรันต่อจากปัจจุบัน แต่วันที่จะเป็นของอดีต ซึ่งผิดหลักการเรียงลำดับเวลา (Chronological Order)\n\nคุณต้องการดำเนินการต่อหรือไม่?\n(แนะนำให้กดยกเลิก แล้วใช้ปุ่ม 'รันเลขเอกสารใหม่ทั้งหมด' แทน)");
         if (!proceed) return;
      }

      sortedNewData.forEach(item => {
        if (!orderInvoiceMap[item.orderId]) {
          maxRunning++;
          const datePart = item.orderDate ? item.orderDate.split(' ')[0].replace(/-/g, '') : '20260101';
          orderInvoiceMap[item.orderId] = `${datePart}-${String(maxRunning).padStart(4, '0')}`;
        }
      });

      const finalDataToInsert = parsedData.map(item => ({
        ...item,
        invoiceNo: orderInvoiceMap[item.orderId]
      }));

      // ดึง orderId ที่ไม่ซ้ำกันจากข้อมูลใหม่ เพื่อลบแล้วแทนที่
      const newOrderIds = [...new Set(finalDataToInsert.map(item => item.orderId))]
      const chunkSize = 100

      // ลบ rows เดิมที่มี orderId เดียวกัน (ทุก product line ของ order นั้น)
      for (let i = 0; i < newOrderIds.length; i += chunkSize) {
        const chunk = newOrderIds.slice(i, i + chunkSize)
        const { error: deleteError } = await supabase
          .from('tax_invoices')
          .delete()
          .in('orderId', chunk)
        
        if (deleteError) console.warn('Delete warning:', deleteError)
      }

      // Insert ทุก row (รวม product line หลายรายการต่อ order)
      for (let i = 0; i < finalDataToInsert.length; i += chunkSize) {
        const batch = finalDataToInsert.slice(i, i + chunkSize)
        const { error: insertError } = await supabase
          .from('tax_invoices')
          .insert(batch)
        
        if (insertError) throw insertError
      }

      alert(`อัปโหลดข้อมูลสำเร็จ ${parsedData.length} รายการ (${newOrderIds.length} คำสั่งซื้อ, เขียนทับข้อมูลเดิมที่มีอยู่)`)
      window.location.reload()
    } catch (error) {
      console.error('Supabase Error:', error)
      alert('ไม่สามารถบันทึกลงฐานข้อมูลได้: ' + error.message)
    }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setLoading(true)
    try {
      const parsedData = await parseShopeeExcel(file)
      await saveToSupabase(parsedData)
    } catch (error) {
      console.error('Error processing file:', error)
      alert(`เกิดข้อผิดพลาด: ${error.message || 'ไม่สามารถประมวลผลไฟล์ได้'}`)
    } finally {
      setLoading(false)
      event.target.value = null; // reset file input
    }
  }

  const handleRecalculateInvoices = async () => {
    const proceed = window.confirm("ยืนยันการจัดเรียงและรันเลขเอกสารใหม่ทั้งหมด?\n\nระบบจะนำข้อมูลทั้งหมดมาเรียงลำดับตามวันที่ และรันเลขเอกสารใหม่ตั้งแต่ 0001 (รูปแบบ ปี/เดือน/วัน-0001) เพื่อแก้ปัญหาวันที่และเลขเอกสารขัดแย้งกัน\n\n**คำเตือน: เอกสารเก่าที่เคยพิมพ์ไปแล้วจะถูกเปลี่ยนเลขใหม่ทั้งหมด**\n\nดำเนินการต่อหรือไม่?");
    if (!proceed) return;

    setLoading(true);
    try {
      const { data: allData, error } = await supabase.from('tax_invoices').select('*');
      if (error) throw error;

      const sorted = [...allData].sort((a, b) => new Date(a.orderDate) - new Date(b.orderDate));
      
      const orderInvoiceMap = {};
      let seq = 0;
      sorted.forEach(item => {
         if (!orderInvoiceMap[item.orderId]) {
            seq++;
            const datePart = item.orderDate ? item.orderDate.split(' ')[0].replace(/-/g, '') : '20260101';
            orderInvoiceMap[item.orderId] = `${datePart}-${String(seq).padStart(4, '0')}`;
         }
      });

      const recordsToUpdate = sorted.map(item => ({
         ...item,
         invoiceNo: orderInvoiceMap[item.orderId]
      }));

      const chunkSize = 100;
      for (let i = 0; i < recordsToUpdate.length; i += chunkSize) {
        const batch = recordsToUpdate.slice(i, i + chunkSize);
        const batchOrderIds = [...new Set(batch.map(item => item.orderId))];
        
        await supabase.from('tax_invoices').delete().in('orderId', batchOrderIds);
        await supabase.from('tax_invoices').insert(batch);
      }

      alert("รันเลขเอกสารใหม่สำเร็จเรียบร้อยแล้ว!");
      window.location.reload();
    } catch (err) {
       console.error(err);
       alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
       setLoading(false);
    }
  };

  const consolidatedData = useMemo(() => {
    const groups = {}

    data.forEach(item => {
      const key = item.orderId
      if (!groups[key]) {
        groups[key] = {
          ...item,          // ข้อมูลพื้นฐาน (customerName, address, orderDate, shippingFee, ฯลฯ)
          items: [],
          totalItemTotal: 0,      // รวมราคาขาย (ก่อนส่วนลด)
          totalShopDiscount: 0,   // รวมส่วนลด (ราคาขาย - ราคาขายสุทธิ)
        }
      }

      groups[key].items.push({
        productName: item.productName,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
        // คำนวณราคาหลังส่วนลด: (ราคาขายรวม - ส่วนลด) / จำนวน
        netPricePerUnit: item.quantity > 0 
          ? (Number(item.itemTotal || 0) - Number(item.shopDiscount || 0)) / item.quantity 
          : item.pricePerUnit,
        itemTotal: item.itemTotal,
        shopDiscount: item.shopDiscount || 0,
      })

      groups[key].totalItemTotal += Number(item.itemTotal || 0)
      groups[key].totalShopDiscount += Number(item.shopDiscount || 0)
    })

    return Object.values(groups).map(order => {
      // ค่าขนส่งและส่วนลดต่างๆ อ้างอิงจาก row แรกของ Order (ไม่บวกซ้ำ)
      const shipping = Number(order.shippingFee || 0)
      const shopeeVoucher = Number(order.shopeeVoucher || 0)
      const coinsUsed = Number(order.coinsUsed || 0)
      const paymentPromo = Number(order.paymentPromo || 0)
      const specialDiscount = Number(order.specialDiscount || 0)

      // สูตรหลัก: รวมเงิน(ทุกรายการ) - ส่วนลดร้านค้า(ทุกรายการ) + ค่าขนส่ง
      const netAmount = order.totalItemTotal - order.totalShopDiscount + shipping
      const taxBase = netAmount / 1.07
      const vatAmount = netAmount - taxBase
      
      // จำนวนเงินทั้งสิ้น = รวมเงินสุทธิ - ส่วนลดพิเศษ
      const grandTotal = netAmount - specialDiscount

      return {
        ...order,
        itemTotal: order.totalItemTotal,
        shopDiscount: order.totalShopDiscount,
        shippingFee: shipping,
        shopeeVoucher,
        coinsUsed,
        paymentPromo,
        specialDiscount,
        netAmount,
        taxBase,
        vatAmount,
        grandTotal,
        invoiceNo: order.invoiceNo // Ensure invoiceNo is passed
      }
    })
  }, [data])

  const sortedConsolidatedData = useMemo(() => {
    return [...consolidatedData].sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))
  }, [consolidatedData])

  const isFiltered = useMemo(() => {
    return !!(searchTerm || startDate || endDate)
  }, [searchTerm, startDate, endDate])

  const filteredData = useMemo(() => {
    const filtered = sortedConsolidatedData.filter(item => {
      const matchSearch = item.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
      
      let matchDate = true
      if (startDate && endDate) {
        const itemDate = new Date(item.orderDate)
        matchDate = itemDate >= new Date(startDate) && itemDate <= new Date(endDate)
      }
      
      return matchSearch && matchDate
    })

    if (!isFiltered) {
      return filtered.slice(0, 150)
    }
    return filtered
  }, [sortedConsolidatedData, searchTerm, startDate, endDate, isFiltered])

  const handleSearch = () => {
    setSearchTerm(searchTermInput)
    setStartDate(startDateInput)
    setEndDate(endDateInput)
    setShowData(true)
  }

  const exportExcel = () => {
    exportToExcel(filteredData)
  }

  const stats = useMemo(() => {
    const totalOrders = filteredData.length
    const totalSales = filteredData.reduce((sum, item) => sum + (item.netAmount || 0), 0)
    const totalVat = filteredData.reduce((sum, item) => sum + (item.vatAmount || 0), 0)
    return { totalOrders, totalSales, totalVat }
  }, [filteredData])

  return (
    <div className="flex-col" style={{ paddingBottom: '5rem' }}>
      <header style={{ textAlign: 'left', marginBottom: '2rem' }}>
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1>Shopee Tax Summary</h1>
          <p>ระบบจัดการภาษีขายและใบกำกับภาษี Shopee</p>
        </motion.div>
      </header>

      <main className="flex-col">
        {/* Controls Section - Redesigned */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          
          {/* Card 1: Data Import */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.8rem' }}>นำเข้าข้อมูล (Import)</h3>
            <div className="flex-col" style={{ gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', opacity: 0.7 }}>อัปโหลดไฟล์รายงาน Shopee (Excel/CSV)</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleFileUpload}
                  style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer', zIndex: 2 }}
                />
                <button style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.8rem' }}>
                  <Upload size={18} /> {loading ? 'กำลังประมวลผล...' : 'เลือกไฟล์เพื่ออัปโหลด'}
                </button>
              </div>
            </div>
            <button 
              onClick={handleRecalculateInvoices}
              style={{ 
                marginTop: 'auto', 
                width: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '0.5rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.85rem',
                padding: '0.6rem'
              }}
            >
              <FileText size={16} /> เรียงลำดับและรันเลขเอกสารใหม่ทั้งหมด
            </button>
          </div>

          {/* Card 2: Export */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.8rem' }}>ส่งออกข้อมูล (Export)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', height: '100%', justifyContent: 'center' }}>
              <button 
                onClick={() => generateBulkInvoicesPDF(filteredData)}
                disabled={filteredData.length === 0}
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', opacity: filteredData.length === 0 ? 0.5 : 1 }}
              >
                <Download size={18} style={{ marginRight: '0.5rem' }} /> Export Invoices PDF ({filteredData.length})
              </button>
              <button 
                onClick={() => generateTaxSummaryPDF(filteredData, { start: startDate || 'All', end: endDate || 'All' })} 
                disabled={filteredData.length === 0}
                style={{ backgroundColor: '#10b981', opacity: filteredData.length === 0 ? 0.5 : 1 }}
              >
                <FileText size={18} style={{ marginRight: '0.5rem' }} /> Export Tax Summary (รายงานภาษี)
              </button>
              <button 
                onClick={exportExcel} 
                disabled={filteredData.length === 0}
                style={{ backgroundColor: '#3b82f6', opacity: filteredData.length === 0 ? 0.5 : 1 }}
              >
                <Download size={18} style={{ marginRight: '0.5rem' }} /> Export to Excel
              </button>
            </div>
          </div>

          {/* Card 3: Filter & Search */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.8rem' }}>ค้นหาและตัวกรอง (Filter)</h3>
            
            <div className="flex-col" style={{ gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', opacity: 0.7 }}>ค้นหา Order ID / ลูกค้า</label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                <input 
                  type="text" 
                  placeholder="พิมพ์คำค้นหา..."
                  value={searchTermInput}
                  onChange={(e) => setSearchTermInput(e.target.value)}
                  style={{ 
                    width: '100%', 
                    boxSizing: 'border-box',
                    padding: '0.6rem 1rem 0.6rem 2.5rem', 
                    borderRadius: '8px', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'white'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="flex-col" style={{ gap: '0.5rem', flex: 1 }}>
                <label style={{ fontSize: '0.9rem', opacity: 0.7 }}>เริ่มต้น</label>
                <input 
                  type="date" 
                  value={startDateInput}
                  onChange={(e) => setStartDateInput(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '0.85rem' }}
                />
              </div>
              <div className="flex-col" style={{ gap: '0.5rem', flex: 1 }}>
                <label style={{ fontSize: '0.9rem', opacity: 0.7 }}>สิ้นสุด</label>
                <input 
                  type="date" 
                  value={endDateInput}
                  onChange={(e) => setEndDateInput(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '0.85rem' }}
                />
              </div>
            </div>
            
            <button 
              onClick={handleSearch}
              style={{ backgroundColor: '#3b82f6', marginTop: 'auto', padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <Search size={16} /> ยืนยันการค้นหา
            </button>
          </div>
        </section>

        {/* Stats Section */}
        {filteredData.length > 0 && (
          <div className="flex-col" style={{ gap: '1rem', marginTop: '2rem' }}>
            {!isFiltered && (
              <div style={{ textAlign: 'left', fontSize: '0.9rem', opacity: 0.7, padding: '0 0.5rem' }}>
                * แสดง 150 รายการล่าสุด (ใช้การค้นหาหรือเลือกวันที่เพื่อดูรายการทั้งหมด)
              </div>
            )}
            <div className="grid-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-card" style={{ padding: '1.5rem', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '0.8rem', borderRadius: '12px' }}>
                    <BarChart3 size={24} color="#3b82f6" />
                  </div>
                  <div>
                    <p style={{ opacity: 0.6, fontSize: '0.9rem', margin: 0 }}>คำสั่งซื้อ{isFiltered ? 'ที่ค้นพบ' : 'ล่าสุด'}</p>
                    <h2 style={{ margin: 0 }}>{stats.totalOrders}</h2>
                  </div>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="glass-card" style={{ padding: '1.5rem', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '0.8rem', borderRadius: '12px' }}>
                    <Download size={24} color="#10b981" />
                  </div>
                  <div>
                    <p style={{ opacity: 0.6, fontSize: '0.9rem', margin: 0 }}>ยอดรวมสุทธิ</p>
                    <h2 style={{ margin: 0 }}>฿{stats.totalSales.toLocaleString()}</h2>
                  </div>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="glass-card" style={{ padding: '1.5rem', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '0.8rem', borderRadius: '12px' }}>
                    <FileText size={24} color="#f59e0b" />
                  </div>
                  <div>
                    <p style={{ opacity: 0.6, fontSize: '0.9rem', margin: 0 }}>ภาษีมูลค่าเพิ่ม (7%)</p>
                    <h2 style={{ margin: 0 }}>฿{stats.totalVat.toLocaleString()}</h2>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {/* Charts Section */}
        {showData && filteredData.length > 0 && <AnalyticsCharts data={filteredData} />}

        {/* Actions Section Removed - Moved to Top Cards */}

        {/* Data Table */}
        {showData && <SummaryTable data={filteredData} />}
      </main>

      <footer style={{ marginTop: '4rem', opacity: 0.5, fontSize: '0.9rem' }}>
        &copy; {new Date().getFullYear()} Shopee Tax Summary Helper - Developed with ❤️
      </footer>
    </div>
  )
}

export default App
