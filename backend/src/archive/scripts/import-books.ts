import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  // Read Excel file
  const workbook = XLSX.readFile('/root/uploads/亲子共读_1775130664619_kf67dj.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log(`Found ${data.length} books in Excel`);

  // Find user andycoy to get familyId
  const user = await prisma.user.findFirst({
    where: { name: 'andycoy', role: 'parent' }
  });

  if (!user) {
    console.error('User andycoy not found');
    return;
  }

  console.log(`Found user andycoy with familyId: ${user.familyId}`);

  let imported = 0;
  let skipped = 0;

  for (const row of data as any[]) {
    const bookName = row['书名'];
    if (!bookName) {
      skipped++;
      continue;
    }

    // Check if book already exists
    const existing = await prisma.book.findFirst({
      where: {
        familyId: user.familyId,
        name: bookName
      }
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Map type
    const typeMap: Record<string, string> = {
      '儿童故事': 'fiction',
      '性格养成': 'character',
      '科学新知': 'science',
      '数学知识': 'math',
      '英语绘本': 'english',
      '国学经典': 'chinese',
      '历史故事': 'history',
      '百科全书': 'encyclopedia',
    };
    const bookType = typeMap[row['类型']] || 'fiction';

    // Create book
    await prisma.book.create({
      data: {
        familyId: user.familyId,
        name: bookName,
        author: row['作者'] || '',
        type: bookType,
        characterTag: row['阅读阶段'] || '',
        coverUrl: '',
        totalPages: 0,
      }
    });

    imported++;
    if (imported % 100 === 0) {
      console.log(`Imported ${imported} books...`);
    }
  }

  console.log(`\nImport completed!`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
