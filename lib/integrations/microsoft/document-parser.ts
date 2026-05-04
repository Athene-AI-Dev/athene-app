import mammoth from 'mammoth'
import * as pdf from 'pdf-parse'
import * as xlsx from 'xlsx'

export async function parseDocument(fileName: string, buffer: Buffer): Promise<string> {
  if (fileName.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } else if (fileName.endsWith('.pdf')) {
    const pdfParser = (pdf as any).default || pdf
    const data = await pdfParser(buffer)
    return data.text
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const workbook = xlsx.read(buffer, { type: 'buffer' })
    let text = ''
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName]
      text += `Sheet: ${sheetName}\n`
      text += xlsx.utils.sheet_to_csv(sheet) + '\n\n'
    })
    return text
  } else if (fileName.endsWith('.txt')) {
    return buffer.toString('utf-8')
  } else {
    // Fallback for other text-based files or try as UTF-8
    return buffer.toString('utf-8')
  }
}
