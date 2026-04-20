const puppeteer = require('puppeteer');

async function measurePageWidths() {
  console.log('开始测量页面宽度...');
  
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const pages = [
      'http://localhost:5177/parent/tasks',
      'http://localhost:5177/parent/plans',
      'http://localhost:5177/parent/library',
      'http://localhost:5177/parent/settings'
    ];
    
    for (const url of pages) {
      try {
        const page = await browser.newPage();
        
        // 设置视口大小为常见的桌面尺寸
        await page.setViewport({ width: 1920, height: 1080 });
        
        // 导航到页面
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // 等待页面加载完成
        await page.waitForTimeout(2000);
        
        // 获取页面宽度信息
        const widthInfo = await page.evaluate(() => {
          return {
            pageWidth: document.body.clientWidth,
            viewportWidth: window.innerWidth,
            screenWidth: screen.width
          };
        });
        
        console.log(`\n页面: ${url}`);
        console.log(`- 页面宽度: ${widthInfo.pageWidth}px`);
        console.log(`- 视口宽度: ${widthInfo.viewportWidth}px`);
        console.log(`- 屏幕宽度: ${widthInfo.screenWidth}px`);
        
        await page.close();
      } catch (error) {
        console.log(`\n页面 ${url} 测量失败: ${error.message}`);
      }
    }
    
    await browser.close();
    console.log('\n测量完成！');
  } catch (error) {
    console.error('测量过程中发生错误:', error);
  }
}

measurePageWidths();