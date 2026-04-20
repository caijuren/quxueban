#!/usr/bin/env node

/**
 * 语雀 Laketable 格式转系统导入 Excel 格式
 * 使用方法: node convert-laketable.js <input.laketable> [output.xlsx]
 */

const fs = require('fs');
const path = require('path');

// 尝试导入 xlsx 库
let XLSX;
try {
  XLSX = require('xlsx');
} catch (e) {
  console.error('请先安装 xlsx 库: npm install xlsx');
  process.exit(1);
}

function convertLaketable(inputFile, outputFile) {
  console.log(`读取文件: ${inputFile}`);
  
  const content = fs.readFileSync(inputFile, 'utf-8');
  const data = JSON.parse(content);
  
  console.log('Laketable 数据结构:', Object.keys(data));
  
  // 提取表格数据
  let rows = [];
  
  if (data.data && Array.isArray(data.data)) {
    rows = data.data;
  } else if (data.rows && Array.isArray(data.rows)) {
    rows = data.rows;
  } else if (data.records && Array.isArray(data.records)) {
    rows = data.records;
  } else {
    // 尝试找到数组类型的字段
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key]) && data[key].length > 0) {
        console.log(`找到数据字段: ${key}, 共 ${data[key].length} 条记录`);
        rows = data[key];
        break;
      }
    }
  }
  
  if (rows.length === 0) {
    console.error('未找到数据记录');
    console.log('数据结构预览:', JSON.stringify(data, null, 2).substring(0, 500));
    process.exit(1);
  }
  
  console.log(`共找到 ${rows.length} 条记录`);
  console.log('第一条记录:', JSON.stringify(rows[0], null, 2));
  
  // 字段映射：语雀字段 -> 系统字段
  const fieldMapping = {
    // 常见语雀字段名 -> 系统标准字段名
    '书名': '书名',
    '书籍名称': '书名',
    'name': '书名',
    'title': '书名',
    
    '作者': '作者',
    'author': '作者',
    'writer': '作者',
    
    '类型': '类型',
    '分类': '类型',
    'category': '类型',
    'type': '类型',
    
    '页数': '页数',
    'pages': '页数',
    '总页数': '页数',
    
    'ISBN': 'ISBN',
    'isbn': 'ISBN',
    
    '出版社': '出版社',
    'publisher': '出版社',
    
    '封面': '封面',
    '封面链接': '封面',
    '图片': '封面',
    'cover': '封面',
    'coverUrl': '封面',
    
    '阅读阶段': '阅读阶段',
    '阶段': '阅读阶段',
    'stage': '阅读阶段',
    
    '适读年龄': '适读年龄',
    '年龄': '适读年龄',
    'age': '适读年龄',
  };
  
  // 转换数据
  const convertedRows = rows.map((row, index) => {
    const newRow = {};
    
    // 遍历所有字段
    for (const [key, value] of Object.entries(row)) {
      // 跳过系统字段
      if (key.startsWith('_') || key === 'id' || key === 'created_at' || key === 'updated_at') {
        continue;
      }
      
      // 查找映射
      const standardField = fieldMapping[key] || key;
      
      // 处理值
      let processedValue = value;
      
      // 处理对象类型（如图片对象）
      if (typeof value === 'object' && value !== null) {
        if (value.url || value.link) {
          processedValue = value.url || value.link;
        } else if (value.text || value.title) {
          processedValue = value.text || value.title;
        } else {
          processedValue = JSON.stringify(value);
        }
      }
      
      newRow[standardField] = processedValue;
    }
    
    // 确保有书名字段
    if (!newRow['书名']) {
      // 尝试从其他字段推断书名
      const possibleNameFields = ['name', 'title', '书籍', 'book'];
      for (const field of possibleNameFields) {
        if (row[field]) {
          newRow['书名'] = row[field];
          break;
        }
      }
    }
    
    return newRow;
  });
  
  // 过滤掉没有书名的记录
  const validRows = convertedRows.filter(row => row['书名']);
  console.log(`有效记录: ${validRows.length} / ${convertedRows.length}`);
  
  // 创建 Excel
  const ws = XLSX.utils.json_to_sheet(validRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '书籍列表');
  
  // 保存文件
  XLSX.writeFile(wb, outputFile);
  console.log(`✅ 转换完成，已保存到: ${outputFile}`);
  
  // 显示字段统计
  const allFields = new Set();
  validRows.forEach(row => Object.keys(row).forEach(k => allFields.add(k)));
  console.log('\n包含字段:', Array.from(allFields).join(', '));
}

// 主程序
const inputFile = process.argv[2];
const outputFile = process.argv[3] || 'books-import.xlsx';

if (!inputFile) {
  console.log('用法: node convert-laketable.js <input.laketable> [output.xlsx]');
  console.log('示例: node convert-laketable.js 亲子共读.laketable books.xlsx');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`文件不存在: ${inputFile}`);
  process.exit(1);
}

convertLaketable(inputFile, outputFile);
