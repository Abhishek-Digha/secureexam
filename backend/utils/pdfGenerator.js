const PDFDocument = require('pdfkit');

async function generatePDF(report) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('EXAM REPORT', { align: 'center' });
      doc.moveDown(2);

      // User Information
      doc.fontSize(16).text('Student Information', { underline: true });
      doc.fontSize(12);
      doc.text(`Name: ${report.userId?.name || '[Name missing]'}`);
      doc.text(`Email: ${report.userId?.email || '[Email missing]'}`);
      doc.text(`Mobile: ${report.userId?.mobile || '[Mobile missing]'}`);
      doc.moveDown();

      // Session Information
      doc.fontSize(16).text('Exam Information', { underline: true });
      doc.fontSize(12);
      doc.text(`Session: ${report.sessionId?.name || '[Session missing]'}`);
      doc.text(`Session Code: ${report.sessionId?.code || '[Session code missing]'}`);
      doc.text(`Submitted At: ${report.submittedAt ? new Date(report.submittedAt).toLocaleString() : '[Submission date missing]'}`);
      doc.moveDown();

      // Detailed Answers
      doc.fontSize(16).text('Detailed Answers', { underline: true });
      doc.moveDown();

      report.answers.forEach((answer, index) => {
        const questionText = answer.questionId?.text || '[Question data missing]';
        const correctAnswer = answer.questionId?.correctAnswer || 'N/A';

        doc.fontSize(12);
        doc.text(`Q${index + 1}. ${questionText}`);

        // Normalize and safely access answer type
        const ansType = (answer.type || '').toLowerCase();

        if (ansType === 'mcq') {
          if (answer.selectedAnswer && answer.selectedAnswer.trim() !== '') {
            doc.text(`Selected Answer: ${answer.selectedAnswer}`);
          } else {
            doc.text('Selected Answer: Not Answered');
          }
          doc.text(`Correct Answer: ${correctAnswer}`);

        } else if (ansType === 'code') {
          if (answer.codeAnswer && answer.codeAnswer.trim() !== '') {
            doc.text('Code Answer:');
            doc.font('Courier').text(answer.codeAnswer, { indent: 20 });
            doc.font('Helvetica'); // Reset font after code
          } else {
            doc.text('Code Answer: Not Answered');
          }
          doc.text('Correct Answer: N/A');

        } else {
          // Fallback for unknown or missing type
          doc.text('Answer type unknown');
          doc.text(`Selected Answer: ${answer.selectedAnswer || 'N/A'}`);
          doc.text(`Code Answer: ${answer.codeAnswer || 'N/A'}`);
          doc.text(`Correct Answer: ${correctAnswer}`);
        }

        doc.moveDown();
      });

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generatePDF };
