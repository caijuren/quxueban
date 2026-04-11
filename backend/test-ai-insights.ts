import { generateAIPrompt, callAIAPI } from './src/modules/ai-insights';

// 模拟测试数据
const testBook = {
  id: 1,
  name: '小王子',
  author: '安托万·德·圣-埃克苏佩里',
  publisher: '译林出版社',
  isbn: '9787544709461',
  totalPages: 120,
  description: '《小王子》是法国作家安托万·德·圣-埃克苏佩里的著名儿童文学短篇小说，讲述了一个来自外星球的小王子的故事。'
};

const testReadingLogs = [
  {
    id: 1,
    childId: 2,
    bookId: 1,
    pages: 30,
    minutes: 20,
    readDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    startPage: 1,
    endPage: 30,
    note: '今天读了第一章，小王子离开自己的星球，开始了星际旅行。'
  },
  {
    id: 2,
    childId: 2,
    bookId: 1,
    pages: 40,
    minutes: 25,
    readDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    startPage: 31,
    endPage: 70,
    note: '读到了小王子遇到狐狸的部分，狐狸教会了小王子什么是友谊。'
  }
];

const testChildInfo = {
  id: 2,
  name: '测试孩子',
  birthDate: '2018-01-01'
};

const testReadingStats = {
  totalDays: 2,
  totalTimes: 2,
  totalMinutes: 45,
  totalPages: 70,
  averageMinutesPerSession: 22,
  averagePagesPerSession: 35
};

// 生成prompt
const prompt = generateAIPrompt(testBook, testBook.description, testReadingLogs, testReadingStats, testChildInfo);
console.log('Generated prompt:', prompt);

// 调用AI API（模拟模式）
callAIAPI(prompt).then(response => {
  console.log('AI Response:', response);
}).catch(error => {
  console.error('Error:', error);
});
