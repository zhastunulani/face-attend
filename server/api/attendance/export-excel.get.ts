import { requireAuth, departmentScope } from '~/server/utils/auth'
import { parsePeriod, monthAttendance } from '~/server/utils/period'
import { workedMinutes } from '~/server/utils/time'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)
  const { year, month, prefix: monthPrefix } = parsePeriod(query.year, query.month)

  const records = await monthAttendance(monthPrefix, departmentScope(user))

  // Group by employee
  const grouped: Record<number, any> = {}
  for (const r of records) {
    const g = grouped[r.employeeId] ??= {
      employeeName: r.employeeName,
      departmentName: r.departmentName || '-',
      workDays: 0,
      lateDays: 0,
      totalLateMinutes: 0,
      totalWorkMinutes: 0,
      totalOvertimeMinutes: 0,
    }
    if (!r.checkIn) continue
    g.workDays++
    if (r.isLate) {
      g.lateDays++
      g.totalLateMinutes += r.lateMinutes
    }
    g.totalOvertimeMinutes += r.overtimeMinutes
    if (r.checkOut) g.totalWorkMinutes += workedMinutes(r.checkIn, r.checkOut)
  }

  // Build Excel XML (SpreadsheetML - opens in Excel, Google Sheets, etc.)
  const rows = Object.values(grouped)
  const monthNames = ['', 'Қаңтар', 'Ақпан', 'Наурыз', 'Сәуір', 'Мамыр', 'Маусым', 'Шілде', 'Тамыз', 'Қыркүйек', 'Қазан', 'Қараша', 'Желтоқсан']
  const title = `Табель - ${monthNames[month]} ${year}`

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1" ss:Size="11"/>
      <Interior ss:Color="#4472C4" ss:Pattern="Solid"/>
      <Font ss:Color="#FFFFFF" ss:Bold="1"/>
    </Style>
    <Style ss:ID="title">
      <Font ss:Bold="1" ss:Size="14"/>
    </Style>
    <Style ss:ID="number">
      <NumberFormat ss:Format="0.0"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Табель">
    <Table>
      <Column ss:Width="50"/>
      <Column ss:Width="180"/>
      <Column ss:Width="140"/>
      <Column ss:Width="100"/>
      <Column ss:Width="100"/>
      <Column ss:Width="120"/>
      <Column ss:Width="100"/>
      <Column ss:Width="120"/>
      <Row>
        <Cell ss:StyleID="title"><Data ss:Type="String">${title}</Data></Cell>
      </Row>
      <Row/>
      <Row>
        <Cell ss:StyleID="header"><Data ss:Type="String">№</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Қызметкер</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Бөлім</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Жұмыс күндері</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Кешіккен күн</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Кешігу (мин)</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Жұмыс сағат</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Үстеме сағат</Data></Cell>
      </Row>`

  rows.forEach((r, i) => {
    const workHours = (r.totalWorkMinutes / 60).toFixed(1)
    const overtimeHours = (r.totalOvertimeMinutes / 60).toFixed(1)
    xml += `
      <Row>
        <Cell><Data ss:Type="Number">${i + 1}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(r.employeeName)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(r.departmentName)}</Data></Cell>
        <Cell><Data ss:Type="Number">${r.workDays}</Data></Cell>
        <Cell><Data ss:Type="Number">${r.lateDays}</Data></Cell>
        <Cell><Data ss:Type="Number">${r.totalLateMinutes}</Data></Cell>
        <Cell ss:StyleID="number"><Data ss:Type="Number">${workHours}</Data></Cell>
        <Cell ss:StyleID="number"><Data ss:Type="Number">${overtimeHours}</Data></Cell>
      </Row>`
  })

  xml += `
    </Table>
  </Worksheet>
</Workbook>`

  setResponseHeaders(event, {
    'Content-Type': 'application/vnd.ms-excel',
    'Content-Disposition': `attachment; filename="tabel_${monthPrefix}.xls"`,
  })

  return xml
})

function escapeXml(str: string): string {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}
