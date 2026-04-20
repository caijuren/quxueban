#!/usr/bin/env node

/**
 * Excel 文件检查工具 - 用于排查导入失败问题
 * 使用方法: node check-excel.js <你的文件.xlsx>
 */

const fs = require('fs');
const path = require('path');

let XLSX;
try {
  XLSX = require('xlsx');
} catch (e) {
  console.error('❌ 请先安装 xlsx 库:');
  console.error('   npm install xlsx');
  process.exit(1);
}

function checkExcel(filePath) {
  console.log('\n========================================');
  console.log('📊 Excel 文件检查报告');
  console.log('========================================\n');

  // 1. 检查文件存在
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 文件不存在: ${filePath}`);
    process.exit(1);
  }

  const stats = fs.statSync(filePath);
  console.log(`📁 文件路径: ${filePath}`);
  console.log(`📦 文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`📝 修改时间: ${stats.mtime.toLocaleString()}`);
  console.log('');

  try {
    // 2. 读取文件
    const workbook = XLSX.readFile(filePath);
    console.log('✅ 文件读取成功');
    console.log(`📑 工作表数量: ${workbook.SheetNames.length}`);
    console.log(`📋 工作表名称: ${workbook.SheetNames.join(', ')}`);
    console.log('');

    // 3. 检查第一个工作表
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // 4. 转换为 JSON
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`📊 数据行数: ${data.length}`);

    if (data.length === 0) {
      console.error('❌ 警告: 没有找到任何数据行！');
      console.log('\n💡 可能原因:');
      console.log('   - Excel 文件是空的');
      console.log('   - 数据不在第一个工作表');
      console.log('   - 第一行不是表头');
      return;
    }

    // 5. 检查列名
    const firstRow = data[0];
    const columns = Object.keys(firstRow);
    console.log(`\n📋 列名 (${columns.length} 个):`);
    columns.forEach((col, idx) => {
      console.log(`   ${idx + 1}. "${col}"`);
    });

    // 6. 检查关键字段
    console.log('\n🔍 关键字段检查:');
    const hasBookName = columns.some(col => 
      col.includes('书名') || col.includes('name') || col.includes('title')
    );
    console.log(`   ${hasBookName ? '✅' : '❌'} 书名字段: ${hasBookName ? '已找到' : '未找到'}`);

    // 7. 检查数据完整性
    console.log('\n📈 数据完整性检查:');
    let emptyNameCount = 0;
    let validRows = 0;

    data.forEach((row, idx) => {
      const name = row['书名'] || row['name'] || row['title'] || row['书籍名称'];
      if (!name || String(name).trim() === '') {
        emptyNameCount++;
      } else {
        validRows++;
      }
    });

    console.log(`   ✅ 有效记录: ${validRows} 行`);
    console.log(`   ⚠️  缺少书名: ${emptyNameCount} 行`);

    if (emptyNameCount > 0) {
      console.log('\n💡 提示: 缺少书名的行将被跳过');
    }

    // 8. 显示前 3 行数据示例
    console.log('\n👁️  数据预览 (前 3 行):');
    data.slice(0, 3).forEach((row, idx) => {
      console.log(`\n   第 ${idx + 1} 行:`);
      columns.slice(0, 5).forEach(col => {
        const value = row[col];
        const display = value === undefined ? '(空)' : String(value).substring(0, 50);
        console.log(`     ${col}: ${display}`);
      });
      if (columns.length > 5) {
        console.log(`     ... 还有 ${columns.length - 5} 个字段`);
      }
    });

    // 9. 检查超链接（封面图片）
    console.log('\n🔗 超链接检查:');
    const links = sheet['!links'] || sheet['!hyperlinks'] || [];
    console.log(`   找到 ${links.length} 个超链接`);

    if (links.length > 0) {
      console.log('   前 3 个超链接:');
      links.slice(0, 3).forEach((link, idx) => {
        const cell = link.ref || link.r || link.cell;
        const target = link.Target || link.target || link.t;
        console.log(`     ${cell} -> ${target?.substring(0, 60)}...`);
      });
    }

    // 10. 给出建议
    console.log('\n========================================');
    console.log('💡 导入建议');
    console.log('========================================');

    if (!hasBookName) {
      console.log('❌ 严重: 没有找到书名字段！');
      console.log('   请确保 Excel 中有以下任一列名:');
      console.log('   - 书名');
      console.log('   - name');
      console.log('   - title');
      console.log('   - 书籍名称');
    } else if (validRows === 0) {
      console.log('❌ 严重: 所有行都缺少书名，无法导入');
    } else {
      console.log('✅ 文件格式看起来正确，可以尝试导入');
      console.log(`   预计可导入: ${validRows} 本书`);
    }

    // 检查文件格式问题
    console.log('\n🐛 常见问题排查:');
    console.log('   1. 如果导入失败，检查浏览器控制台 (F12) 的网络请求');
    console.log('   2. 确保文件是 .xlsx 格式，不是 .xls 或 .csv');
    console.log('   3. 文件大小不要超过 10MB');
    console.log('   4. 第一行必须是列名（表头）');

  } catch (error) {
    console.error('\n❌ 读取文件失败:');
    console.error(`   ${error.message}`);
    console.log('\n💡 可能原因:');
    console.log('   - 文件已损坏');
    console.log('   - 文件格式不正确（需要 .xlsx）');
    console.log('   - 文件被其他程序占用');
  }

  console.log('\n========================================\n');
}

// 主程序
const filePath = process.argv[2];

if (!filePath) {
  console.log('用法: node check-excel.js <文件路径>');
  console.log('示例: node check-excel.js ~/Downloads/books.xlsx');
  process.exit(1);
}

checkExcel(filePath);
