const PDFDocument = require('pdfkit');
const prisma = require('../prisma');

const generateCertificate = async (req, res) => {
  const { attemptId } = req.params;
  const userId = req.user.id;

  try {
    const attempt = await prisma.attempt.findUnique({
      where: { id: parseInt(attemptId) },
      include: {
        quiz: true,
        user: true
      }
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Quiz attempt not found' });
    }

    // Security check: Only the student who took the quiz or an Admin can download it
    if (req.user.role === 'STUDENT' && attempt.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: This certificate does not belong to you' });
    }

    // Business Logic Validation: Certificate is only awarded for >= 60% score
    const totalMarks = attempt.quiz.totalMarks;
    const score = attempt.score;
    const percentage = (score / totalMarks) * 100;

    if (percentage < 60.0) {
      return res.status(403).json({
        error: `Certificate locked: You must score at least 60% to unlock. Your score: ${percentage.toFixed(1)}%`
      });
    }

    // Set response headers for direct PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Certificate_${attempt.quiz.title.replace(/\s+/g, '_')}.pdf`);

    // Create a new PDF document in Landscape
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 40, left: 40, right: 40, bottom: 40 }
    });

    doc.pipe(res);

    // --- Elegant Professional Design ---

    // 1. Sleek Outer Border
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40)
       .lineWidth(3)
       .strokeColor('#2A2D3E') // deep carbon
       .stroke();

    // 2. Fancy Thin Inner Border
    doc.rect(28, 28, doc.page.width - 56, doc.page.height - 56)
       .lineWidth(1)
       .strokeColor('#4F46E5') // indigo accent
       .stroke();

    // 3. Header Medal/Graphic (Vector-drawn Gold Badge)
    const centerX = doc.page.width / 2;
    
    // Draw gold outer circle
    doc.circle(centerX, 85, 30)
       .fillColor('#EAB308')
       .fill();
    
    // Draw gold inner star/text
    doc.circle(centerX, 85, 25)
       .fillColor('#CA8A04')
       .fill();

    doc.circle(centerX, 85, 20)
       .fillColor('#EAB308')
       .fill();

    // Title text
    doc.fillColor('#1F2937'); // dark charcoal
    doc.fontSize(28)
       .font('Helvetica-Bold')
       .text('CERTIFICATE OF ACHIEVEMENT', 0, 140, { align: 'center' });

    doc.fontSize(14)
       .font('Helvetica')
       .fillColor('#4B5563')
       .text('THIS IS PROUDLY PRESENTED TO', 0, 185, { align: 'center' });

    // Student's Name (Enormous & Bold)
    doc.fontSize(36)
       .font('Helvetica-Bold')
       .fillColor('#4F46E5') // Indigo
       .text(attempt.user.name.toUpperCase(), 0, 215, { align: 'center' });

    // Descriptive Achievement Text
    doc.fontSize(14)
       .font('Helvetica')
       .fillColor('#4B5563')
       .text('for successfully demonstrating knowledge and mastery in', 0, 270, { align: 'center' });

    // Quiz Title (Bold, Carbon color)
    doc.fontSize(22)
       .font('Helvetica-Bold')
       .fillColor('#111827')
       .text(attempt.quiz.title, 0, 295, { align: 'center' });

    // Attempt Details Table
    const detailsY = 345;
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#4B5563');

    // Render formatted string with score details
    doc.text(`Score Earned: ${score.toFixed(1)} / ${totalMarks}  (${percentage.toFixed(1)}%)`, 0, detailsY, { align: 'center' });
    doc.text(`Completed on: ${new Date(attempt.endTime).toLocaleDateString()}`, 0, detailsY + 20, { align: 'center' });

    // Decorative Signatures
    const sigY = 440;
    
    // Left side: Examiner/QuizMaster Line
    doc.moveTo(100, sigY).lineTo(300, sigY).lineWidth(1).strokeColor('#9CA3AF').stroke();
    doc.fontSize(10).font('Helvetica-Oblique').text('Exam Administrator', 100, sigY + 5, { width: 200, align: 'center' });
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1F2937').text('QUIZ PORTAL INC.', 100, sigY - 20, { width: 200, align: 'center' });

    // Right side: Student Signature
    doc.moveTo(doc.page.width - 300, sigY).lineTo(doc.page.width - 100, sigY).lineWidth(1).strokeColor('#9CA3AF').stroke();
    doc.fontSize(10).font('Helvetica-Oblique').text('Verification ID', doc.page.width - 300, sigY + 5, { width: 200, align: 'center' });
    doc.fontSize(10).font('Courier-Bold').fillColor('#4B5563').text(`VERIFY-ATTEMPT-${attempt.id}`, doc.page.width - 300, sigY - 18, { width: 200, align: 'center' });

    // Finalize the PDF
    doc.end();

  } catch (err) {
    console.error('Certificate generation error:', err);
    res.status(500).json({ error: 'Failed to compile certificate file' });
  }
};

module.exports = {
  generateCertificate
};
