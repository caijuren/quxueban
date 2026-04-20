// 宽度检查脚本
function checkWidth() {
  const widthInfo = {
    pageWidth: document.body.clientWidth,
    viewportWidth: window.innerWidth,
    screenWidth: screen.width
  };
  
  console.log('页面宽度信息:', widthInfo);
  
  // 创建一个简单的显示元素
  const infoDiv = document.createElement('div');
  infoDiv.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #000;
    color: #fff;
    padding: 10px;
    border-radius: 5px;
    font-size: 12px;
    z-index: 9999;
  `;
  
  infoDiv.innerHTML = `
    页面宽度: ${widthInfo.pageWidth}px<br>
    视口宽度: ${widthInfo.viewportWidth}px<br>
    屏幕宽度: ${widthInfo.screenWidth}px
  `;
  
  document.body.appendChild(infoDiv);
}

// 页面加载完成后执行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkWidth);
} else {
  checkWidth();
}

// 窗口大小改变时重新检查
window.addEventListener('resize', checkWidth);