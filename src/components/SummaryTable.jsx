import React from 'react';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { generateInvoicePDF } from '../utils/invoiceUtils';

const SummaryTable = ({ data = [] }) => {
  return (
    <motion.div 
      className="glass-card"
      style={{ marginTop: '2rem', padding: '1.5rem', overflowX: 'auto' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h3 style={{ textAlign: 'left', marginBottom: '1.5rem' }}>รายการภาษี ({data.length} รายการ)</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <th style={{ padding: '0.75rem 0.5rem' }}>วันที่</th>
            <th style={{ padding: '0.75rem 0.5rem' }}>เลขที่เอกสาร</th>
            <th style={{ padding: '0.75rem 0.5rem' }}>เลขที่คำสั่งซื้อ</th>
            <th style={{ padding: '0.75rem 0.5rem' }}>ลูกค้า</th>
            <th style={{ padding: '0.75rem 0.5rem' }}>ยอดสุทธิ</th>
            <th style={{ padding: '0.75rem 0.5rem' }}>ส่วนลดพิเศษ</th>
            <th style={{ padding: '0.75rem 0.5rem' }}>รวมทั้งสิ้น</th>
            <th style={{ padding: '0.75rem 0.5rem' }}>การจัดการ</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>
                ยังไม่มีข้อมูล กรุณาอัปโหลดไฟล์รายงาน Shopee
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '0.75rem 0.5rem', whiteSpace: 'nowrap' }}>{row.orderDate ? row.orderDate.split(' ')[0] : '-'}</td>
                <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem', color: '#10b981', fontWeight: '500' }}>{row.invoiceNo || '-'}</td>
                <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontFamily: 'monospace' }}>{row.orderId || '-'}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{row.customerName || 'ลูกค้า Shopee'}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{Number(row.netAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '0.75rem 0.5rem', color: '#ef4444' }}>-{Number(row.specialDiscount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>{Number(row.grandTotal || row.netAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>
                  <button 
                    onClick={() => generateInvoicePDF(row, index + 1)}
                    style={{ 
                      padding: '0.3rem 0.6rem', 
                      background: 'rgba(59, 130, 246, 0.1)', 
                      color: '#3b82f6',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.75rem'
                    }}
                  >
                    <Download size={12} /> PDF
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </motion.div>
  );
};

export default SummaryTable;
