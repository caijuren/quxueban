// 测试导出功能的脚本
const fs = require('fs');
const path = require('path');

// 检查 html2canvas 是否存在
const html2canvasPath = path.join(__dirname, 'node_modules', 'html2canvas');

if (fs.existsSync(html2canvasPath)) {
  console.log('✅ html2canvas 库存在');
  
  // 检查 package.json 中的依赖
  const packageJsonPath = path.join(__dirname, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.dependencies && packageJson.dependencies.html2canvas) {
      console.log('✅ html2canvas 已在 package.json 中配置');
      console.log('✅ 版本:', packageJson.dependencies.html2canvas);
    } else {
      console.log('❌ html2canvas 未在 package.json 中配置');
    }
  } else {
    console.log('❌ package.json 文件不存在');
  }
} else {
  console.log('❌ html2canvas 库不存在');
}

console.log('\n测试完成！');
