import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { format: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header missing' },
        { status: 401 }
      )
    }

    const format = params.format
    const body = await request.json()

    // Temporary mock file generation until backend is properly connected
    console.log('🔄 Generating mock audit export file in format:', format)

    let contentType: string
    let fileContent: string
    let filename: string

    if (format === 'csv') {
      contentType = 'text/csv'
      filename = 'audit-report.csv'
      fileContent = `id,event_type,user_id,timestamp,severity,category
550e8400-e29b-41d4-a716-446655440000,user_login,550e8400-e29b-41d4-a716-446655440001,${new Date().toISOString()},info,Security Change
550e8400-e29b-41d4-a716-446655440003,project_update,550e8400-e29b-41d4-a716-446655440001,${new Date(Date.now() - 60 * 60 * 1000).toISOString()},info,Financial Impact`
    } else {
      contentType = 'application/pdf'
      filename = 'audit-report.pdf'
      // Simple PDF content - minimal valid PDF structure
      const pdfHeader = '%PDF-1.4\n'
      const catalog = '1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n'
      const pages = '2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n'
      const page = '3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n'
      const content = '4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n72 720 Td\n/F0 12 Tf\n(Audit Report - Demo Data) Tj\nET\nendstream\nendobj\n'
      const xref = 'xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000200 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n284\n%%EOF'

      fileContent = pdfHeader + catalog + pages + page + content + xref
    }

    // Return the mock file with appropriate headers
    return new NextResponse(Buffer.from(fileContent), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error generating audit export:', error)
    return NextResponse.json(
      { error: 'Failed to generate export file' },
      { status: 500 }
    )
  }
}