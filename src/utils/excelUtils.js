import * as XLSX from 'xlsx';

export const parseShopeeExcel = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 1. อ่านแบบ JSON ปกติ (เพื่อใช้ชื่อคอลัมน์สำหรับข้อมูลสินค้า)
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        // 2. อ่านแบบ Raw Array (เพื่อใช้ตำแหน่ง AD, AI, AJ, AP สำหรับส่วนลด)
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          resolve([]);
          return;
        }

        const parseNum = (val) => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') return parseFloat(val.replace(/,/g, '')) || 0;
          return 0;
        };

        const mappedData = jsonData.map((row, index) => {
          // ข้อมูลใน rawRows จะเริ่มที่ Index + 1 (เพราะแถว 0 คือ Header)
          const rawRow = rawRows[index + 1] || [];

          // --- ข้อมูลพื้นฐาน (ใช้ชื่อคอลัมน์แบบเดิมที่เคยดึงได้ถูก) ---
          const orderId = row['หมายเลขคำสั่งซื้อ'];
          const customerName = row['ชื่อผู้ใช้ (ผู้ซื้อ)'] || 'ลูกค้า Shopee';
          const address = row['ที่อยู่ในการจัดส่ง'] || '-';
          const orderDate = row['วันที่ทำการสั่งซื้อ'];
          const productName = row['ชื่อสินค้า'] || 'สินค้า Shopee';
          const sku = row['เลขรหัส SKU'] || '-';
          
          // ราคาขาย และ จำนวน (ใช้ชื่อคอลัมน์)
          const salesPrice = parseNum(row['ราคาขาย'] || row['ราคาตั้งต้น']);
          const quantity = parseInt(row['จำนวน'] || 1);
          const itemTotal = salesPrice * quantity;

          // ส่วนลดร้านค้า
          const netSalesPrice = parseNum(row['ราคาขายสุทธิ'] || row['ราคาสุทธิ']);
          const netItemTotal = netSalesPrice > 0 ? netSalesPrice * quantity : itemTotal;
          const shopDiscount = itemTotal - netItemTotal;

          // --- ส่วนลดพิเศษ (ใช้ตำแหน่ง Index AD, AI, AJ, AP ที่คำนวณได้ถูกแล้ว) ---
          const getRawVal = (idx) => {
            const v = rawRow[idx];
            if (v === undefined || v === null || v === '') return 0;
            if (typeof v === 'number') return v;
            return parseFloat(String(v).replace(/,/g, '')) || 0;
          };

          const shopeeVoucher = getRawVal(29); // AD: ส่วนลด Shopee (ยอด 140)
          const coinsUsed = getRawVal(34);     // AI: เหรียญ
          const paymentPromo = getRawVal(35);  // AJ: โปรโมชั่นชำระเงิน
          const shippingFee = getRawVal(41);   // AP: ค่าจัดส่ง (ยอด 48)

          // สูตร: โค้ดส่วนลด + (เหรียญ/100) + โปรโมชั่นชำระเงิน + ค่าส่ง
          const specialDiscount = shopeeVoucher + (coinsUsed / 100) + paymentPromo + shippingFee;

          // ยอดเงินสุทธิ (รวมเงิน - ส่วนลดร้านค้า + ค่าจัดส่ง)
          const netAmount = itemTotal - shopDiscount + shippingFee;
          
          // จำนวนเงินทั้งสิ้น (หลังหักส่วนลดพิเศษ)
          const grandTotal = netAmount - specialDiscount;

          const taxBase = netAmount / 1.07;
          const vatAmount = netAmount - taxBase;

          return {
            orderId,
            customerName,
            address,
            orderDate,
            productName,
            sku,
            pricePerUnit: salesPrice,
            quantity: quantity,
            itemTotal: itemTotal,
            shopDiscount: shopDiscount,
            shopeeVoucher: shopeeVoucher,
            coinsUsed: coinsUsed,
            paymentPromo: paymentPromo,
            shippingFee: shippingFee,
            specialDiscount: specialDiscount,
            grandTotal: grandTotal,
            netAmount: netAmount,
            taxBase: taxBase,
            vatAmount: vatAmount,
            status: row['สถานะการสั่งซื้อ']
          };
        }).filter(item => item.orderId);

        resolve(mappedData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const exportToExcel = (data, fileName = 'Tax_Invoice_Summary.xlsx') => {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoices');
    XLSX.writeFile(workbook, fileName);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert('เกิดข้อผิดพลาดในการส่งออก Excel: ' + error.message);
  }
};
