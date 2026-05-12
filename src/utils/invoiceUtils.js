import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import SarabunFont from '../fonts/SarabunFont';
import { bahttext, normalizeThaiPDF } from './thaiUtils';

/**
 * Helper to trigger file download with a specific name
 */
const triggerDownload = (doc, fileName) => {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
};

/**
 * Register the Sarabun Thai font to a jsPDF doc instance
 */
const registerThaiFont = (doc) => {
  try {
    // Ensure the font data is clean
    const cleanFont = SarabunFont.replace(/\s/g, '');
    doc.addFileToVFS('Sarabun-Regular.ttf', cleanFont);
    doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
    doc.setFont('Sarabun');
  } catch (err) {
    console.error('Font registration failed:', err);
  }
};

/**
 * Draw one invoice pane (Original or Copy) – matches the user's sample form
 */
const drawInvoicePane = (doc, xOffset, data, type, index) => {
  const w = 138; 
  const x = xOffset + 6;
  let y = 10;

  doc.setFont('Sarabun', 'normal');
  doc.setTextColor(30, 41, 59);

  // ---- Header: Shop Info ----
  doc.setFontSize(15);
  doc.setFont('Sarabun', 'normal');
  doc.text('นางสาวปฏิญญะณัฐ ศรีพจนวรกุล', x, y + 2);
  
  doc.setFontSize(8);
  doc.setFont('Sarabun', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('19 หมู่ 1 ต.สวนปาน อ.เมือง จ.นครปฐม 73000', x, y + 7);
  doc.text('เลขประจำตัวผู้เสียภาษี 1739900372559 สำนักงานใหญ่', x, y + 11);

  // ---- Tag Label (Original/Copy) ----
  const tagLabel = type === 'original' ? 'ต้นฉบับ / ORIGINAL' : 'สำเนา / COPY';
  const tagSubLabel = type === 'original' ? 'สำหรับลูกค้า' : 'สำหรับร้านค้า';
  
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.rect(x + w - 38, y - 5, 36, 10, 'D');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(tagLabel, x + w - 20, y - 0.5, { align: 'center' });
  doc.setFontSize(7);
  doc.text(tagSubLabel, x + w - 20, y + 3.5, { align: 'center' });

  // ---- Title Box ----
  y += 22;
  doc.setDrawColor(30, 41, 59);
  doc.setFillColor(248, 250, 252);
  doc.rect(x + 30, y, 78, 12, 'FD');
  doc.setFontSize(13);
  doc.setFont('Sarabun', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text('ใบเสร็จรับเงิน / ใบกำกับภาษี', x + 69, y + 6.5, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('Sarabun', 'normal');
  doc.text('RECEIPT / TAX INVOICE', x + 69, y + 10.5, { align: 'center' });

  // ---- Customer & Order Info ----
  y += 18;
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  
  doc.text('นามลูกค้า:', x, y);
  doc.text(data.customerName || 'ลูกค้า Shopee', x + 18, y);
  
  doc.text('หมายเลขคำสั่งซื้อ:', x + 65, y);
  doc.setFont('Sarabun', 'normal');
  doc.text(data.orderId || '-', x + 90, y);
  doc.setFont('Sarabun', 'normal');

  y += 6;
  doc.text('ที่อยู่:', x, y);
  const addr = data.address || '-';
  const addrLines = doc.splitTextToSize(addr, w - 22);
  doc.setFontSize(8);
  doc.text(addrLines, x + 18, y);
  
  y += Math.max(addrLines.length * 3.5, 6);

  doc.setFontSize(9);
  doc.text('เลขประจำตัวผู้เสียภาษี:', x, y);
  doc.text('0000000000000', x + 35, y);

  const dateStr = data.orderDate ? data.orderDate.split(' ')[0] : '-';
  const invoiceNo = data.invoiceNo || '-';
  doc.text(`วันที่: ${dateStr}`, x + 68, y);
  doc.text(`เลขที่: ${invoiceNo}`, x + 102, y);

  // ---- Table Section ----
  y += 5;
  const tableBody = (data.items || []).map((item, idx) => [
    idx + 1,
    (item.productName || '').substring(0, 55),
    item.quantity || 0,
    'ชิ้น',
    Number(item.netPricePerUnit || item.pricePerUnit || 0).toFixed(2),
    Number(item.itemTotal - (item.shopDiscount || 0)).toFixed(2),
  ]);

  // Fixed rows to keep table height constant
  const fixedRows = 10;
  const displayItems = tableBody.slice(0, fixedRows);
  while (displayItems.length < fixedRows) {
    displayItems.push(['', '', '', '', '', '']);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: x, right: 297 - x - w },
    tableWidth: w,
    head: [[
      normalizeThaiPDF('ลำดับ'), 
      normalizeThaiPDF('ชื่อสินค้า'), 
      normalizeThaiPDF('จำนวน'), 
      normalizeThaiPDF('หน่วย'), 
      normalizeThaiPDF('ราคา/หน่วย'), 
      normalizeThaiPDF('จำนวนเงิน (บาท)')
    ]],
    body: displayItems,
    theme: 'plain',
    styles: { 
      font: 'Sarabun', 
      fontStyle: 'normal', 
      fontSize: 8, 
      cellPadding: 2, 
      textColor: [30, 41, 59],
      lineWidth: 0, 
    },
    headStyles: { font: 'Sarabun', fontStyle: 'normal', fillColor: [51, 65, 85], textColor: 255, halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      2: { halign: 'center', cellWidth: 12 },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'right', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 25 },
    },
    // Custom drawing to remove horizontal lines in body but keep vertical and outer ones
    didDrawCell: (data) => {
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.1);
      
      // Draw vertical lines for all cells
      doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
      if (data.column.index === data.table.columns.length - 1) {
        doc.line(data.cell.x + data.cell.width, data.cell.y, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }

      // Draw bottom line ONLY for the header and the very last row
      if (data.section === 'head') {
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      } else if (data.section === 'body' && data.row.index === data.table.body.length - 1) {
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    }
  });

  // ---- Totals Section ----
  let ty = doc.lastAutoTable.finalY + 4;
  const totalX = x + w - 65; 
  const valX = x + w - 2;

  const totalNetAmount = Number(data.netAmount || 0);
  const totalSpecialDiscount = Number(data.specialDiscount || 0);
  const finalGrandTotal = totalNetAmount - totalSpecialDiscount;

  const totals = [
    ['รวมเงิน', Number(data.itemTotal || 0).toFixed(2)],
    ['ส่วนลด', `(${Number(data.shopDiscount || 0).toFixed(2)})`],
    ['ค่าขนส่ง', Number(data.shippingFee || 0).toFixed(2)],
    ['รวมเงินสุทธิ', totalNetAmount.toFixed(2)],
    ['มูลค่าที่คำนวณภาษี', Number(data.taxBase || 0).toFixed(2)],
    ['ภาษีมูลค่าเพิ่ม 7%', Number(data.vatAmount || 0).toFixed(2)],
    ['ส่วนลดพิเศษ', `(${totalSpecialDiscount.toFixed(2)})`],
    ['จำนวนเงินทั้งสิ้น', finalGrandTotal.toFixed(2)],
  ];

  doc.setFontSize(9);
  totals.forEach(([label, val], idx) => {
    const isLast = idx === totals.length - 1;
    const isDiscount = idx === 1; // ส่วนลดร้านค้า
    const isSpecialDiscount = idx === 6; // ส่วนลดพิเศษ
    
    if (isLast) {
      doc.setFont('Sarabun', 'normal');
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.3);
      doc.line(totalX, ty - 4, valX, ty - 4);
    }
    
    doc.text(normalizeThaiPDF(label), totalX, ty);
    
    if (isDiscount || isSpecialDiscount) {
      doc.setTextColor(220, 38, 38); // สีแดงสำหรับส่วนลด
      doc.text(val, valX, ty, { align: 'right' });
      doc.setTextColor(30, 41, 59);
    } else {
      doc.text(val, valX, ty, { align: 'right' });
    }
    ty += 5;
  });

  // Baht Text Box
  const btY = doc.lastAutoTable.finalY + 4;
  doc.setDrawColor(203, 213, 225);
  doc.rect(x, btY, w - 70, 10);
  doc.setFontSize(9);
  doc.text(normalizeThaiPDF(`ตัวอักษร: (${bahttext(finalGrandTotal)})`), x + 3, btY + 6.5);

  // Signatures
  // Ensure signature starts at least at 188, but push down if totals are long
  let signY = Math.max(188, ty + 5); 
  doc.setFontSize(9);
  doc.text('ผู้รับเงิน ...........................................................', x, signY);
  doc.text('ผู้รับสินค้า ...........................................................', x + 72, signY);
  signY += 8;
  doc.text('ลงวันที่ .............................................................', x, signY);
  doc.text('ลงวันที่ .............................................................', x + 72, signY);
};

/**
 * Generate Invoice PDF – Landscape A4 with Original (left) + Copy (right)
 */
export const generateInvoicePDF = (data, index) => {
  try {
    const doc = new jsPDF('l', 'mm', 'a4');
    registerThaiFont(doc);
    
    // Left side: Original
    drawInvoicePane(doc, 0, data, 'original', index || 1);

    // Divider
    doc.setLineDash([2, 2], 0);
    doc.setDrawColor(100, 100, 100);
    doc.line(148.5, 5, 148.5, 205);
    doc.setLineDash([]);
    doc.setDrawColor(0);

    // Right side: Copy
    drawInvoicePane(doc, 148.5, data, 'copy', index || 1);

    const sanitizedId = (data.orderId || 'Download').replace(/[^a-z0-9]/gi, '_');
    const fileName = `Invoice_${sanitizedId}.pdf`;
    
    triggerDownload(doc, fileName);
    console.log('PDF Generated:', fileName);
  } catch (error) {
    console.error('Error generating Invoice PDF:', error);
    alert('เกิดข้อผิดพลาดในการสร้างใบกำกับภาษี: ' + error.message);
  }
};

/**
 * Generate Multiple Invoices in a single PDF - One page per invoice
 */
export const generateBulkInvoicesPDF = (items) => {
  try {
    if (!items || items.length === 0) throw new Error('ไม่มีข้อมูลสำหรับสร้างใบกำกับภาษี');

    const doc = new jsPDF('l', 'mm', 'a4');
    registerThaiFont(doc);

    items.forEach((item, idx) => {
      if (idx > 0) doc.addPage();
      
      // Draw the invoice pane (Original + Copy) on the current page
      drawInvoicePane(doc, 0, item, 'original', idx + 1);
      
      doc.setLineDash([2, 2], 0);
      doc.setDrawColor(100, 100, 100);
      doc.line(148.5, 5, 148.5, 205);
      doc.setLineDash([]);
      doc.setDrawColor(0);
      
      drawInvoicePane(doc, 148.5, item, 'copy', idx + 1);
    });

    const fileName = `Invoices_Bulk_${new Date().getTime()}.pdf`;
    triggerDownload(doc, fileName);
    console.log('Bulk PDF Generated:', fileName);
  } catch (error) {
    console.error('Error generating Bulk Invoices PDF:', error);
    alert('เกิดข้อผิดพลาดในการสร้างใบกำกับภาษีชุด: ' + error.message);
  }
};

/**
 * Generate Tax Summary Report PDF – Portrait A4
 */
export const generateTaxSummaryPDF = (data, dateRange) => {
  try {
    if (!data || data.length === 0) throw new Error('ไม่มีข้อมูลสำหรับสร้างรายงาน');

    const doc = new jsPDF('p', 'mm', 'a4');
    registerThaiFont(doc);

    // Sort data by date
    const sortedData = [...data].sort((a, b) => new Date(a.orderDate) - new Date(b.orderDate));

    // Determine actual date range from data
    const dates = sortedData.map(item => item.orderDate?.split(' ')[0]).filter(Boolean);
    const actualStart = dateRange.start && dateRange.start !== 'All' ? dateRange.start : dates[0] || '-';
    const actualEnd = dateRange.end && dateRange.end !== 'All' ? dateRange.end : dates[dates.length - 1] || '-';

    const totalBase = sortedData.reduce((sum, item) => sum + Number(item.taxBase || 0), 0);
    const totalVat = sortedData.reduce((sum, item) => sum + Number(item.vatAmount || 0), 0);

    const drawHeader = (d) => {
      d.setFont('Sarabun', 'normal');
      d.setFontSize(16);
      d.setTextColor(0, 0, 0);
      d.text(normalizeThaiPDF('รายงานภาษีขาย'), 105, 15, { align: 'center' });
      d.setFontSize(10);
      d.text(normalizeThaiPDF(`ช่วงเวลา: ${actualStart}  ถึง  ${actualEnd}`), 105, 22, { align: 'center' });
      d.setFontSize(9);
      d.text(normalizeThaiPDF('ชื่อผู้ประกอบการ'), 15, 30);
      d.text(normalizeThaiPDF('นางสาวปฏิญญะณัฐ ศรีพจนวรกุล'), 55, 30);
      d.text(normalizeThaiPDF('เลขประจำตัวผู้เสียภาษี'), 130, 30);
      d.text('1 7399 00372 55 9', 170, 30);
      d.text(normalizeThaiPDF('ชื่อสถานประกอบ'), 15, 36);
      d.text(normalizeThaiPDF('นางสาวปฏิญญะณัฐ ศรีพจนวรกุล'), 55, 36);
      d.rect(130, 33, 4, 4);
      d.text('X', 130.8, 36.2);
      d.text(normalizeThaiPDF('สำนักงานใหญ่'), 136, 36);
      d.rect(165, 33, 4, 4);
      d.text(normalizeThaiPDF('สาขาที่'), 171, 36);
    };

    // Prepare table data
    const tableBody = sortedData.map((item, idx) => {
      return [
        idx + 1,
        item.orderDate ? item.orderDate.split(' ')[0] : '-',
        item.invoiceNo || '-',
        normalizeThaiPDF(item.customerName || 'ลูกค้า Shopee'),
        '0000000000000',
        Number(item.taxBase || 0).toFixed(2),
        Number(item.vatAmount || 0).toFixed(2),
      ];
    });

    drawHeader(doc);

    // Track per-page row info using didDrawCell
    const pageInfo = {}; // { pageNum: { rowIndices: [], lastY: 0 } }

    autoTable(doc, {
      startY: 42,
      margin: { top: 42, left: 15, right: 15 },
      head: [
        [
          { content: normalizeThaiPDF('ลำดับที่'), styles: { halign: 'center' } },
          { content: normalizeThaiPDF('วัน เดือน ปี'), styles: { halign: 'center' } },
          { content: normalizeThaiPDF('ใบกำกับภาษีเลขที่'), styles: { halign: 'center' } },
          { content: normalizeThaiPDF('ชื่อผู้ซื้อสินค้า/ผู้รับบริการ'), styles: { halign: 'center' } },
          { content: normalizeThaiPDF('เลขประจำตัวผู้เสียภาษี\nของผู้รับบริการ'), styles: { halign: 'center' } },
          { content: normalizeThaiPDF('มูลค่าสินค้า\nหรือบริการ'), styles: { halign: 'center' } },
          { content: normalizeThaiPDF('จำนวนเงินภาษี\nมูลค่าเพิ่ม'), styles: { halign: 'center' } },
        ],
      ],
      body: tableBody,
      styles: { font: 'Sarabun', fontStyle: 'normal', fontSize: 8, cellPadding: 2 },
      headStyles: { font: 'Sarabun', fontStyle: 'normal', fillColor: [240, 240, 240], textColor: [0, 0, 0], lineWidth: 0.1, fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 28, halign: 'center' },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 32, halign: 'center' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 20, halign: 'right' },
      },
      didDrawPage: (hookData) => {
        if (hookData.pageNumber > 1) {
          drawHeader(doc);
        }
      },
      didDrawCell: (cellData) => {
        // Only track body rows, only need column 0 to record row index
        if (cellData.section === 'body' && cellData.column.index === 0) {
          const pg = cellData.pageNumber;
          if (!pageInfo[pg]) pageInfo[pg] = { rowIndices: [], lastY: 0 };
          pageInfo[pg].rowIndices.push(cellData.row.index);
          const rowBottom = cellData.cell.y + cellData.cell.height;
          if (rowBottom > pageInfo[pg].lastY) pageInfo[pg].lastY = rowBottom;
        }
      },
    });

    // ---- Draw per-page subtotals and grand total ----
    const totalPages = doc.internal.getNumberOfPages();

    for (let page = 1; page <= totalPages; page++) {
      doc.setPage(page);
      const info = pageInfo[page];
      if (!info || info.rowIndices.length === 0) continue;

      const pageBase = info.rowIndices.reduce((s, rowIdx) => s + parseFloat(tableBody[rowIdx]?.[5] || 0), 0);
      const pageVat = info.rowIndices.reduce((s, rowIdx) => s + parseFloat(tableBody[rowIdx]?.[6] || 0), 0);
      const subY = info.lastY + 1;

      // Page subtotal row
      doc.setFontSize(8);
      doc.setFont('Sarabun', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFillColor(245, 245, 220);
      doc.rect(15, subY, 180, 7, 'F');
      doc.setDrawColor(180, 180, 180);
      doc.rect(15, subY, 180, 7, 'D');
      doc.text(normalizeThaiPDF('รวมหน้านี้'), 120, subY + 5, { align: 'right' });
      doc.text(pageBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 173, subY + 5, { align: 'right' });
      doc.text(pageVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 195, subY + 5, { align: 'right' });

      // Grand total — only on last page
      if (page === totalPages) {
        const grandY = subY + 9;
        doc.setFontSize(9);
        doc.setFont('Sarabun', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.setFillColor(255, 255, 200);
        doc.rect(15, grandY, 180, 8, 'F');
        doc.setDrawColor(100, 100, 100);
        doc.rect(15, grandY, 180, 8, 'D');
        doc.text(normalizeThaiPDF('รวมทั้งสิ้น'), 120, grandY + 5.5, { align: 'right' });
        doc.text(totalBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 173, grandY + 5.5, { align: 'right' });
        doc.text(totalVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 195, grandY + 5.5, { align: 'right' });
      }
    }

    const fileName = `Tax_Summary_${actualStart}_${actualEnd}.pdf`;
    triggerDownload(doc, fileName);
    console.log('Tax Summary PDF Generated:', fileName);
  } catch (error) {
    console.error('Error generating Tax Summary PDF:', error);
    alert('เกิดข้อผิดพลาดในการสร้างรายงานภาษี: ' + error.message);
  }
};
