import mammoth from 'mammoth'
import * as pdf from 'pdf-parse'
import ExcelJS from 'exceljs'

export async function parseDocument(fileName: string, buffer: Buffer): Promise<string> {
  if (fileName.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } else if (fileName.endsWith('.pdf')) {
    const pdfParser = (pdf as any).default || pdf
    const data = await pdfParser(buffer)
    return data.text
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as any)
    let text = ''
    workbook.eachSheet((sheet) => {
      text += `Sheet: ${sheet.name}\n`
      sheet.eachRow((row) => {
        const rowValues = Array.isArray(row.values) 
          ? row.values.slice(1).map(v => (v && typeof v === 'object' ? JSON.stringify(v) : String(v || ''))).join(',')
          : ''
        text += rowValues + '\n'
      })
      text += '\n'
    })
    return text
  } else if (fileName.endsWith('.txt')) {
    return buffer.toString('utf-8')
  } else {
    // Fallback for other text-based files or try as UTF-8
    return buffer.toString('utf-8')
  }
}
