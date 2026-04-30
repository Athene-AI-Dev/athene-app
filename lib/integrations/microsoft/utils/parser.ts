import mammoth from 'mammoth'
import * as pdf from 'pdf-parse'
import * as xlsx from 'xlsx'

/**
 * Common document parser for Microsoft 365 file formats.
 */
export async function parseMicrosoftDoc(buffer: Buffer, fileName: string): Promise<string> {
  const name = fileName.toLowerCase()

  if (name.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } else if (name.endsWith('.pdf')) {
    const pdfParser = (pdf as any).default || pdf
    const data = await pdfParser(buffer)
    return data.text
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const workbook = xlsx.read(buffer, { type: 'buffer' })
    let text = ''
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName]
      text += `Sheet: ${sheetName}\n`
      text += xlsx.utils.sheet_to_csv(sheet) + '\n\n'
    })
    return text
  } else if (name.endsWith('.txt')) {
    return buffer.toString('utf-8')
  } else {
    // Fallback for other text-based files or try as UTF-8
    return buffer.toString('utf-8')
  }
}
