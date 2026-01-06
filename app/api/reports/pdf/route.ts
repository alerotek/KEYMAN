import { createSupabaseServer } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { generateBookingReport, generateBookingReportHTML } from '@/lib/reports/bookingReport'
import { generateRevenueReport, generateRevenueReportHTML } from '@/lib/reports/revenueReport'
import { generateOccupancyReport, generateOccupancyReportHTML } from '@/lib/reports/occupancyReport'

export const dynamic = 'force-dynamic'

async function generatePDFContent(html: string): Promise<Buffer> {
  // In a real implementation, you would use a PDF library like puppeteer or pdf-lib
  // For now, we'll return the HTML as a buffer (this won't create a real PDF)
  // but demonstrates the structure
  const htmlBuffer = Buffer.from(html, 'utf-8')
  return htmlBuffer
}

export async function POST(request: Request) {
  try {
    // Require admin role
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await request.json()
    const { type, startDate, endDate } = body

    if (!type || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Report type, start date, and end date are required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServer()

    let htmlContent = ''
    let fileName = ''

    // Generate report based on type
    switch (type) {
      case 'booking':
        const bookingData = await generateBookingReport(startDate, endDate)
        htmlContent = generateBookingReportHTML(bookingData, startDate, endDate)
        fileName = `booking-report-${new Date().toISOString().split('T')[0]}.pdf`
        break

      case 'revenue':
        const revenueData = await generateRevenueReport(startDate, endDate)
        htmlContent = generateRevenueReportHTML(revenueData, startDate, endDate)
        fileName = `revenue-report-${new Date().toISOString().split('T')[0]}.pdf`
        break

      case 'occupancy':
        const occupancyData = await generateOccupancyReport(startDate, endDate)
        htmlContent = generateOccupancyReportHTML(occupancyData, startDate, endDate)
        fileName = `occupancy-report-${new Date().toISOString().split('T')[0]}.pdf`
        break

      default:
        return NextResponse.json(
          { error: 'Invalid report type. Must be booking, revenue, or occupancy' },
          { status: 400 }
        )
    }

    // Generate PDF (simplified - returns HTML as buffer)
    const pdfBuffer = await generatePDFContent(htmlContent)

    // Log report generation to audit
    await supabase
      .from('audit_log')
      .insert([{
        action: 'pdf_report_generated',
        details: {
          report_type: type,
          start_date: startDate,
          end_date: endDate,
          file_name: fileName,
          timestamp: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      }])

    // Return PDF as downloadable file
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })

  } catch (error) {
    console.error('PDF report generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF report' },
      { status: 500 }
    )
  }
}
