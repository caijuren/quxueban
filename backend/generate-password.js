const bcrypt = require('bcryptjs');

async function generate() {
  const password = '123456';
  const hash = await bcrypt.hash(password, 12);
  console.log('密码:', password);
  console.log('哈希:', hash);
}

generate();
