# 演讲评分系统 - 完整需求文档

一个基于Firebase的实时演讲评分系统，支持多人协作、实时数据同步。

## 📋 完整功能需求

### 🎯 核心系统需求
- **演讲评分系统**：6人总数，2人演讲，4人评委
- **两种评分算法**：
  - 去掉一个最高分一个最低分求平均值
  - 直接求加权平均
- **网页形式**：可实现分享与拉用户
- **Firebase数据库**：云端数据存储

### 🔐 登录权限系统
- **管理员登录**：
  - 账号："友好102"
  - 密码："69141024"
  - 只有管理员可以委派谁为演讲者，谁为评委
- **评委登录**：输入名字即可登录
- **演讲者登录**：输入名字即可登录

### 👑 管理员权限（增强版）
- **系统设置**：
  - 设置总人数限制
  - 设置评委总人数
  - 设置演讲总人数
- **用户管理**：
  - 添加用户
  - 批量添加用户
  - 一键选择添加评委或演讲者
  - 自动分配角色
  - 随机分配角色
- **查看权限**：
  - 可以看见每个参与者（评委）的分数
  - 查看之前的评分记录（历史记录）
- **评选管理**：
  - 保存这次评选
  - 不保留此次评选

### 🏆 评委权限
- **评分功能**：
  - 只有评委才可以评分
  - 评委之间给的分互相看不见
  - 一键全部提交评分功能
- **界面导航**：
  - 返回登录（不能进入管理员界面）

### 🎤 演讲者权限
- **查看权限**：
  - 只能看到最后的分数
  - 看不到具体是哪个评委给的分
- **界面导航**：
  - 返回登录（不能进入管理员界面）

### 📊 分享结果功能
- **分享方式**：
  - 导出结果的链接
  - 生成二维码
  - 分享会话（邀请参与）
  - 分享结果（只读）

### 🔄 界面导航需求
- **返回功能**：各个页面都要有返回上一个页面的功能
- **权限隔离**：评委和演讲者不能访问管理员功能

### 💾 数据存储需求
- **Firebase云端数据库**：主要存储
- **历史数据查看**：从Firebase云端数据库查看
- **需要添加的集合**：`saved_sessions`（历史记录）

### 🎮 会话管理
- **会话ID系统**：支持多个独立的评分会话
- **实时同步**：多人可以同时参与同一会话
- **会话分享**：通过链接邀请他人加入

## 📋 配置步骤

### 1. Firebase项目设置

1. **创建Firebase项目**
   - 访问 [Firebase控制台](https://console.firebase.google.com/)
   - 点击"创建项目"
   - 输入项目名称（如：speech-scoring-system）
   - 选择是否启用Google Analytics（可选）

2. **启用Firestore数据库**
   - 在项目控制台中，点击"Firestore Database"
   - 点击"创建数据库"
   - 选择"以测试模式启动"（开发阶段）
   - 选择数据库位置（建议选择离用户最近的区域）

3. **获取配置信息**
   - 在项目设置中，找到"您的应用"部分
   - 点击"</>"图标添加Web应用
   - 输入应用昵称
   - 复制配置对象

### 2. 代码配置

在 `script.js` 文件顶部，将Firebase配置替换为你的项目配置：

```javascript
const firebaseConfig = {
    apiKey: "your-actual-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};
```

### 3. Firestore安全规则（可选）

为了更好的安全性，可以在Firestore规则中设置：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 允许所有用户读写sessions集合
    match /sessions/{sessionId} {
      allow read, write: if true;
    }
    
    // 测试连接文档
    match /test/{document} {
      allow read, write: if true;
    }
  }
}
```

## 🎯 使用方法

### 管理员操作
1. 选择"管理员登录"
2. 输入账号：`友好102`，密码：`69141024`
3. 添加用户（最多6人）
4. 分配角色：2个演讲者，4个评委
5. 选择评分方法并开始评分
6. 实时查看评分进度和详细结果

### 评委操作
1. 选择"评委登录"
2. 输入管理员分配给你的姓名
3. 为每位演讲者评分（0-100分）
4. 提交后无法修改

### 演讲者操作
1. 选择"演讲者登录"
2. 输入你的姓名
3. 查看评分进度
4. 评分完成后查看最终得分

## 🔄 会话管理

### 创建新会话
- 管理员可以创建新的评分会话
- 每个会话有独立的用户和评分数据
- 会话ID可用于其他人加入

### 加入现有会话
- 通过会话ID加入现有的评分会话
- 支持多人同时参与同一会话
- 实时同步所有操作

### 分享会话
- 管理员可以分享会话链接
- 其他用户通过链接直接加入会话
- URL格式：`?session=会话ID`

## 💾 数据存储结构

### Firestore集合结构
```
sessions/
  └── {sessionId}/
      ├── users: Array<User>
      ├── speakers: Array<User>
      ├── judges: Array<User>
      ├── scores: Object
      ├── scoringMethod: String
      ├── scoringStarted: Boolean
      └── lastUpdated: Timestamp
```

### 本地存储回退
- 如果Firebase连接失败，自动使用localStorage
- 数据结构保持一致
- 功能完全可用，但无实时同步

## 🛠 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **数据库**: Firebase Firestore
- **实时同步**: Firebase实时监听器
- **回退方案**: localStorage
- **部署**: 静态文件托管（GitHub Pages, Netlify等）

## 📱 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 🔧 故障排除

### Firebase连接失败
1. 检查网络连接
2. 验证Firebase配置是否正确
3. 确认Firestore数据库已启用
4. 检查浏览器控制台错误信息

### 数据不同步
1. 检查Firebase连接状态
2. 确认多个用户使用相同的会话ID
3. 刷新页面重新连接

### 权限问题
1. 检查Firestore安全规则
2. 确认用户角色分配正确
3. 验证登录信息

## 📈 性能优化建议

1. **网络优化**
   - 选择离用户最近的Firebase区域
   - 使用CDN加速Firebase SDK加载

2. **数据优化**
   - 定期清理过期会话数据
   - 合理设置Firestore索引

3. **用户体验**
   - 添加加载状态指示器
   - 实现离线缓存机制

## 🔒 安全建议

1. **生产环境**
   - 设置严格的Firestore安全规则
   - 启用Firebase身份验证
   - 定期更新管理员密码

2. **数据保护**
   - 定期备份重要数据
   - 设置数据访问日志
   - 限制会话生命周期

## 📞 支持与反馈

如有问题或建议，请通过以下方式联系：
- 创建GitHub Issue
- 发送邮件反馈
- 提交Pull Request

## 📄 许可证

本项目采用MIT许可证，详见LICENSE文件。