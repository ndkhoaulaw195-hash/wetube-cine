/**
 * MUA HÀNG HOÀN TIỀN (muahanghoantien.vn)
 * Main Application Engine
 */

// ==================== INITIAL DATA & STATE ====================
const STORAGE_KEY = 'muahanghoantien_state_v1';

const DEFAULT_STATE = {
  user: {
    id: '98421',
    name: 'Trần Ngọc Nam',
    initial: 'TN',
    rank: 'Thành viên Thân thiết (Hạng Bạc)'
  },
  wallet: {
    available: 128500,
    pending: 64200,
    withdrawn: 450000
  },
  orders: [
    {
      id: 'SP-88392102',
      platform: 'Shopee',
      productName: 'Tai nghe chụp tai Bluetooth Hoco W35 Pin 40H',
      amount: 450000,
      cashback: 38250,
      date: '01/11/2026 14:20',
      status: 'pending' // 'pending' | 'approved' | 'cancelled'
    },
    {
      id: 'LZ-49201944',
      platform: 'Lazada',
      productName: 'Nồi chiên không dầu Philips HD9252/90 4.1L',
      amount: 1490000,
      cashback: 119200,
      date: '28/10/2026 19:45',
      status: 'approved'
    },
    {
      id: 'TT-77402911',
      platform: 'TikTok',
      productName: 'Áo Polo Nam Form Regular Pique Cotton',
      amount: 220000,
      cashback: 26400,
      date: '25/10/2026 11:15',
      status: 'approved'
    },
    {
      id: 'SP-33920188',
      platform: 'Shopee',
      productName: 'Củ sạc nhanh Baseus GaN 65W 3 cổng Type-C',
      amount: 320000,
      cashback: 25600,
      date: '20/10/2026 09:30',
      status: 'approved'
    }
  ],
  withdrawals: [
    {
      id: 'WD-2026102901',
      bank: 'Vietcombank',
      accountNumber: '9984******12',
      accountName: 'TRAN NGOC NAM',
      amount: 250000,
      date: '29/10/2026 10:30',
      status: 'completed'
    },
    {
      id: 'WD-2026101502',
      bank: 'MBBank',
      accountNumber: '0903******88',
      accountName: 'TRAN NGOC NAM',
      amount: 200000,
      date: '15/10/2026 16:45',
      status: 'completed'
    }
  ]
};

// Top 10 Leaderboard Mock Data (Matches muahanghoantien.com reality)
const LEADERBOARD_DATA = [
  { rank: 1, id: '5197', username: 'Tueha1***', orders: 84, cashback: 1112280, reward: '1.000.000 đ' },
  { rank: 2, id: '3183', username: 'Hang1***', orders: 36, cashback: 107738, reward: '500.000 đ' },
  { rank: 3, id: '493', username: 'Congvan***', orders: 29, cashback: 67339, reward: '300.000 đ' },
  { rank: 4, id: '8922', username: 'MinhKhoi***', orders: 25, cashback: 54100, reward: '100.000 đ' },
  { rank: 5, id: '6140', username: 'ThuThao***', orders: 22, cashback: 48900, reward: '100.000 đ' },
  { rank: 6, id: '7721', username: 'HoangLong***', orders: 19, cashback: 42300, reward: '50.000 đ' },
  { rank: 7, id: '1054', username: 'NgocLinh***', orders: 17, cashback: 38650, reward: '50.000 đ' },
  { rank: 8, id: '9402', username: 'ThanhSang***', orders: 15, cashback: 35100, reward: '50.000 đ' },
  { rank: 9, id: '2281', username: 'BaoNgoc***', orders: 14, cashback: 31200, reward: '50.000 đ' },
  { rank: 10, id: '8119', username: 'TuanAnh***', orders: 12, cashback: 28400, reward: '50.000 đ' }
];

// Product Deals & Coupons Catalog
const DEALS_DATA = [
  {
    id: 1,
    title: 'Cáp Sạc Nhanh Type-C Bọc Dù Chống Đứt 1M Dành Cho Android/iPhone',
    platform: 'Shopee',
    category: 'sale1k',
    price: 1000,
    originalPrice: 35000,
    cashbackPercent: '12%',
    cashbackVal: 4200,
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&auto=format&fit=crop&q=80',
    link: 'https://shopee.vn/cap-sac-nhanh-type-c-1k-i.12345.67890',
    badge: 'Flash Sale 1K'
  },
  {
    id: 2,
    title: 'Giá Đỡ Điện Thoại Để Bàn Gấp Gọn Đa Năng Bằng Nhôm Cao Cấp',
    platform: 'Shopee',
    category: 'sale1k',
    price: 9000,
    originalPrice: 49000,
    cashbackPercent: '10%',
    cashbackVal: 4900,
    image: 'https://images.unsplash.com/photo-1586105251261-72a756497a11?w=400&auto=format&fit=crop&q=80',
    link: 'https://shopee.vn/gia-do-dien-thoai-gap-gon-i.23456.78901',
    badge: 'Deal 9K'
  },
  {
    id: 3,
    title: 'Tai Nghe Không Dây Bluetooth True Wireless Chống Ồn ENC Cảm Ứng',
    platform: 'Lazada',
    category: 'tech',
    price: 199000,
    originalPrice: 390000,
    cashbackPercent: '15%',
    cashbackVal: 29850,
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&auto=format&fit=crop&q=80',
    link: 'https://s.lazada.vn/s.tai-nghe-tws-bluetooth',
    badge: 'LazMall -50%'
  },
  {
    id: 4,
    title: 'Son Kem Lì Mịn Môi Kháng Nước Lâu Trôi Black Rouge Air Fit Velvet',
    platform: 'TikTok',
    category: 'beauty',
    price: 135000,
    originalPrice: 210000,
    cashbackPercent: '18%',
    cashbackVal: 24300,
    image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400&auto=format&fit=crop&q=80',
    link: 'https://vt.tiktok.com/ZS.son-black-rouge-velvet',
    badge: 'TikTok Hot'
  },
  {
    id: 5,
    title: 'Bàn Phím Cơ Không Dây 3 Chế Độ Bluetooth 5.0 / 2.4G / Type-C LED RGB',
    platform: 'Shopee',
    category: 'tech',
    price: 499000,
    originalPrice: 850000,
    cashbackPercent: '8.5%',
    cashbackVal: 42400,
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&auto=format&fit=crop&q=80',
    link: 'https://shopee.vn/ban-phim-co-led-rgb-i.34567.89012',
    badge: 'Freeship Xtra'
  },
  {
    id: 6,
    title: 'Serum Cấp Ẩm Phục Hồi Da The Ordinary Hyaluronic Acid 2% + B5 30ml',
    platform: 'Lazada',
    category: 'beauty',
    price: 185000,
    originalPrice: 280000,
    cashbackPercent: '12%',
    cashbackVal: 22200,
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&auto=format&fit=crop&q=80',
    link: 'https://s.lazada.vn/s.serum-ordinary-b5',
    badge: 'Chính Hãng'
  },
  {
    id: 7,
    title: 'Bình Giữ Nhiệt Lock&Lock Thép Không Gỉ 316 500ml Giữ Nhiệt 24 Giờ',
    platform: 'Shopee',
    category: 'sale1k',
    price: 29000,
    originalPrice: 265000,
    cashbackPercent: '9%',
    cashbackVal: 23800,
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&auto=format&fit=crop&q=80',
    link: 'https://shopee.vn/binh-giu-nhiet-lock-lock-i.45678.90123',
    badge: 'Deal 29K'
  },
  {
    id: 8,
    title: 'Chuột Máy Tính Không Dây Bluetooth Slient Chống Ồn Pin Sạc Siêu Nhẹ',
    platform: 'Shopee',
    category: 'tech',
    price: 89000,
    originalPrice: 150000,
    cashbackPercent: '14%',
    cashbackVal: 12460,
    image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=400&auto=format&fit=crop&q=80',
    link: 'https://shopee.vn/chuot-khong-day-slient-i.56789.01234',
    badge: 'Flash Sale'
  }
];

// Payout stream ticker messages
const MOCK_PAYOUT_TICKER = [
  { user: 'Tueha1***', amount: '1.112.280đ', bank: 'Vietcombank' },
  { user: 'ThanhLong***', amount: '145.000đ', bank: 'MBBank' },
  { user: 'MinhKhoi***', amount: '82.500đ', bank: 'Techcombank' },
  { user: 'Hang1***', amount: '107.738đ', bank: 'VPBank' },
  { user: 'ThuThao***', amount: '56.000đ', bank: 'MoMo' },
  { user: 'Congvan***', amount: '67.339đ', bank: 'ACB' },
  { user: 'VanHuy***', amount: '320.000đ', bank: 'VietinBank' }
];

// App State in Memory
let state = loadState();
let currentCreatedProduct = null;

// ==================== STATE MANAGEMENT ====================
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Lỗi đọc LocalStorage:', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Lỗi ghi LocalStorage:', e);
  }
  renderHeaderAndWallet();
}

function resetDemoData() {
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  saveState();
  initApp();
  showToast('Đã khôi phục dữ liệu Demo thành công!', 'info');
}

// ==================== FORMAT HELPERS ====================
function formatVND(amount) {
  if (typeof amount !== 'number') amount = Number(amount) || 0;
  return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==================== TAB NAVIGATION ====================
window.switchTab = function(tabId) {
  // Hide all tabs
  document.querySelectorAll('.page-tab').forEach(tab => tab.classList.remove('active'));
  
  // Show target tab
  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) {
    targetTab.classList.add('active');
  }

  // Update desktop nav
  document.querySelectorAll('.desktop-nav .nav-item').forEach(item => item.classList.remove('active'));
  const targetNavBtn = document.getElementById(`nav-btn-${tabId}`);
  if (targetNavBtn) targetNavBtn.classList.add('active');

  // Update mobile bottom nav
  document.querySelectorAll('.mob-nav-btn').forEach(btn => btn.classList.remove('active'));
  const targetMobBtn = document.getElementById(`mobNav${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
  if (targetMobBtn) targetMobBtn.classList.add('active');

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.scrollToConverter = function() {
  switchTab('home');
  const el = document.getElementById('converterContainer');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('linkInput').focus();
  }
};

window.toggleWalletSubTab = function(subtab) {
  const btnOrders = document.getElementById('btnTabOrders');
  const btnWithdrawals = document.getElementById('btnTabWithdrawals');
  const tabOrders = document.getElementById('subtab-orders');
  const tabWithdrawals = document.getElementById('subtab-withdrawals');

  if (subtab === 'orders') {
    btnOrders.classList.add('active');
    btnWithdrawals.classList.remove('active');
    tabOrders.classList.add('active');
    tabWithdrawals.classList.remove('active');
  } else {
    btnWithdrawals.classList.add('active');
    btnOrders.classList.remove('active');
    tabWithdrawals.classList.add('active');
    tabOrders.classList.remove('active');
  }
};

window.toggleAccordion = function(headEl) {
  const card = headEl.parentElement;
  card.classList.toggle('open');
};

// ==================== LINK CONVERTER ENGINE ====================
window.fillSampleLink = function(platform) {
  const input = document.getElementById('linkInput');
  if (platform === 'shopee') {
    input.value = 'https://shopee.vn/Tai-nghe-Bluetooth-Hoco-W35-Pin-40H-i.48201.993821';
  } else if (platform === 'lazada') {
    input.value = 'https://s.lazada.vn/s.Noi-chien-khong-dau-Philips-HD9252';
  } else if (platform === 'tiktok') {
    input.value = 'https://vt.tiktok.com/ZS.Ao-Polo-Nam-Cotton-Form-Regular';
  }
  handleConvertLink();
};

window.pasteFromClipboard = async function() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      document.getElementById('linkInput').value = text.trim();
      showToast('Đã dán liên kết từ bộ nhớ tạm!', 'info');
      handleConvertLink();
    }
  } catch (err) {
    // Fallback if permission denied
    document.getElementById('linkInput').focus();
    showToast('Vui lòng bấm Ctrl+V hoặc dán trực tiếp vào ô nhập!', 'warning');
  }
};

window.handleConvertLink = function() {
  const input = document.getElementById('linkInput');
  const rawUrl = (input.value || '').trim();

  if (!rawUrl) {
    showToast('Vui lòng nhập hoặc dán link sản phẩm Shopee, Lazada hoặc TikTok!', 'warning');
    input.focus();
    return;
  }

  const btn = document.getElementById('btnConvert');
  const btnContent = document.getElementById('btnConvertContent');
  btnContent.innerHTML = `
    <span style="display:inline-block;animation:spin 1s linear infinite;margin-right:6px">⏳</span>
    Đang phân tích link...
  `;
  btn.disabled = true;

  setTimeout(() => {
    btn.disabled = false;
    btnContent.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
      Tạo Link Hoàn Tiền
    `;
    processParsedLink(rawUrl);
  }, 600);
};

function processParsedLink(url) {
  let platform = 'Shopee';
  let rate = 8.5;
  let productName = 'Sản phẩm Shopee Mall Chính Hãng';
  let price = 350000;
  let thumb = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&auto=format&fit=crop&q=80';

  const lower = url.toLowerCase();

  if (lower.includes('shopee') || lower.includes('shp.ee')) {
    platform = 'Shopee';
    rate = 8.5;
    if (lower.includes('tai-nghe') || lower.includes('hoco')) {
      productName = 'Tai nghe Bluetooth Hoco W35 Pin 40 Giờ - Âm Bass Trầm';
      price = 450000;
      thumb = 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&auto=format&fit=crop&q=80';
    } else {
      productName = 'Sản phẩm tuyển chọn Shopee Mall (Được hỗ trợ hoàn tiền)';
      price = 280000;
      thumb = 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&auto=format&fit=crop&q=80';
    }
  } else if (lower.includes('lazada') || lower.includes('s.lazada')) {
    platform = 'Lazada';
    rate = 8.0;
    if (lower.includes('noi-chien') || lower.includes('philips')) {
      productName = 'Nồi chiên không dầu Philips HD9252/90 4.1L Cảm Ứng';
      price = 1490000;
      thumb = 'https://images.unsplash.com/photo-1586105251261-72a756497a11?w=400&auto=format&fit=crop&q=80';
    } else {
      productName = 'Sản phẩm Lazada Mall Đảm Bảo 100% Chính Hãng';
      price = 550000;
      thumb = 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&auto=format&fit=crop&q=80';
    }
  } else if (lower.includes('tiktok')) {
    platform = 'TikTok';
    rate = 12.0;
    productName = 'Áo Polo Nam Form Regular Pique Cotton Kháng Khuẩn';
    price = 220000;
    thumb = 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400&auto=format&fit=crop&q=80';
  } else {
    platform = 'Thương Mại Điện Tử';
    rate = 7.0;
    productName = 'Sản phẩm mua sắm trực tuyến hỗ trợ hoàn tiền';
    price = 200000;
  }

  const cashback = Math.round((price * rate) / 100);

  // Affiliate tracking link with user sub_id
  const trackingUrl = `https://muahanghoantien.vn/click?url=${encodeURIComponent(url)}&sub_id=${state.user.id}&utm_source=muahanghoantien`;

  currentCreatedProduct = {
    platform,
    productName,
    price,
    rate,
    cashback,
    trackingUrl,
    thumb
  };

  // Render Result Card
  const resultCard = document.getElementById('convertResultCard');
  document.getElementById('resPlatformTag').innerText = `${platform} Mall`;
  document.getElementById('resRateTag').innerText = `Hoàn ${rate}% (Dự kiến ${formatVND(cashback)})`;
  document.getElementById('resProductName').innerText = productName;
  document.getElementById('resPrice').innerText = formatVND(price);
  document.getElementById('resCashbackVal').innerText = `+${formatVND(cashback)} về ví`;
  document.getElementById('resProductImg').src = thumb;
  document.getElementById('finalGeneratedLink').value = trackingUrl;
  document.getElementById('btnOpenLink').href = trackingUrl;

  resultCard.style.display = 'block';
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  showToast('Đã tạo link hoàn tiền thành công! Bạn có thể sao chép hoặc mở ứng dụng để mua.', 'success');
}

window.copyCashbackLink = function() {
  const link = document.getElementById('finalGeneratedLink').value;
  if (!link) return;

  navigator.clipboard.writeText(link).then(() => {
    const btn = document.getElementById('btnCopyLink');
    btn.innerHTML = `✓ Đã chép!`;
    setTimeout(() => {
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        Sao chép
      `;
    }, 2000);
    showToast('Đã sao chép link hoàn tiền vào clipboard!', 'success');
  });
};

// ==================== SIMULATED ORDER CHECKOUT ====================
window.simulateOrderCheckout = function() {
  if (!currentCreatedProduct) {
    showToast('Vui lòng tạo link hoàn tiền trước khi giả lập mua hàng!', 'warning');
    return;
  }

  const orderId = `${currentCreatedProduct.platform.substring(0, 2).toUpperCase()}-${Math.floor(10000000 + Math.random() * 90000000)}`;
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const newOrder = {
    id: orderId,
    platform: currentCreatedProduct.platform,
    productName: currentCreatedProduct.productName,
    amount: currentCreatedProduct.price,
    cashback: currentCreatedProduct.cashback,
    date: dateStr,
    status: 'pending'
  };

  // Prepend new order
  state.orders.unshift(newOrder);
  state.wallet.pending += currentCreatedProduct.cashback;
  saveState();

  showToast(`🎉 Giả lập thành công: Đơn ${orderId} đã được ghi nhận! +${formatVND(currentCreatedProduct.cashback)} vào số dư chờ duyệt.`, 'success');

  // Trigger simulated conversion after 5s to available balance for demonstration
  setTimeout(() => {
    const target = state.orders.find(o => o.id === orderId);
    if (target && target.status === 'pending') {
      target.status = 'approved';
      state.wallet.pending -= target.cashback;
      state.wallet.available += target.cashback;
      saveState();
      showToast(`💰 Đơn hàng ${orderId} đã đối soát xong! Số dư khả dụng +${formatVND(target.cashback)}.`, 'success');
    }
  }, 6000);
};

// ==================== WITHDRAWAL MODAL & WORKFLOW ====================
window.openWithdrawModal = function() {
  document.getElementById('modalAvailableAmount').innerText = formatVND(state.wallet.available);
  document.getElementById('withdrawAmount').max = state.wallet.available;
  document.getElementById('withdrawModal').classList.add('active');
};

window.closeWithdrawModal = function() {
  document.getElementById('withdrawModal').classList.remove('active');
};

window.setQuickWithdraw = function(amt) {
  document.getElementById('withdrawAmount').value = amt;
};

window.setQuickWithdrawAll = function() {
  document.getElementById('withdrawAmount').value = state.wallet.available;
};

window.handleWithdrawSubmit = function(e) {
  e.preventDefault();
  const bank = document.getElementById('bankSelect').value;
  const accNum = document.getElementById('bankAccountNumber').value.trim();
  const accName = document.getElementById('bankAccountName').value.trim().toUpperCase();
  const amount = Number(document.getElementById('withdrawAmount').value);

  if (amount < 20000) {
    showToast('Số tiền rút tối thiểu là 20.000 VNĐ!', 'warning');
    return;
  }

  if (amount > state.wallet.available) {
    showToast('Số dư khả dụng của bạn không đủ để thực hiện yêu cầu này!', 'warning');
    return;
  }

  // Deduct available, add to withdrawn
  state.wallet.available -= amount;
  state.wallet.withdrawn += amount;

  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const newWithdrawal = {
    id: `WD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${Math.floor(1000 + Math.random() * 9000)}`,
    bank,
    accountNumber: accNum.replace(/.(?=.{4})/g, '*'),
    accountName: accName,
    amount,
    date: dateStr,
    status: 'completed'
  };

  state.withdrawals.unshift(newWithdrawal);
  saveState();
  closeWithdrawModal();

  showToast(`Yêu cầu rút ${formatVND(amount)} về ngân hàng ${bank} thành công! Tiền sẽ về trong vài phút.`, 'success');
};

// ==================== USER PROFILE MODAL ====================
window.openUserModal = function() {
  document.getElementById('userProfileName').innerText = state.user.name;
  document.getElementById('userInitial').innerText = state.user.initial;
  document.getElementById('userTotalOrdersCount').innerText = state.orders.length;
  
  const totalEarned = state.wallet.available + state.wallet.pending + state.wallet.withdrawn;
  document.getElementById('userLifeEarnings').innerText = formatVND(totalEarned);
  document.getElementById('userModal').classList.add('active');
};

window.closeUserModal = function() {
  document.getElementById('userModal').classList.remove('active');
};

// ==================== RENDERING LOGIC ====================
function renderHeaderAndWallet() {
  // Header
  const headerWalletEl = document.getElementById('headerWalletBalance');
  if (headerWalletEl) headerWalletEl.innerText = formatVND(state.wallet.available);

  // Wallet Tab stats
  const availEl = document.getElementById('walletAvailableBalance');
  const pendEl = document.getElementById('walletPendingBalance');
  const withEl = document.getElementById('walletTotalWithdrawn');

  if (availEl) availEl.innerText = formatVND(state.wallet.available);
  if (pendEl) pendEl.innerText = formatVND(state.wallet.pending);
  if (withEl) withEl.innerText = formatVND(state.wallet.withdrawn);

  // Counts
  const ordCountEl = document.getElementById('ordersCount');
  const wdCountEl = document.getElementById('withdrawalsCount');
  if (ordCountEl) ordCountEl.innerText = state.orders.length;
  if (wdCountEl) wdCountEl.innerText = state.withdrawals.length;

  renderOrdersTable();
  renderWithdrawalsTable();
}

function renderOrdersTable() {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  const search = (document.getElementById('orderSearchInput')?.value || '').toLowerCase();
  const filterStatus = document.getElementById('orderStatusFilter')?.value || 'all';

  const filtered = state.orders.filter(item => {
    const matchesSearch = item.id.toLowerCase().includes(search) || item.productName.toLowerCase().includes(search);
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:#94a3b8">Không tìm thấy đơn hàng nào phù hợp</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(order => {
    let statusBadge = '';
    if (order.status === 'pending') {
      statusBadge = `<span class="badge-status pending">⏳ Chờ đối soát</span>`;
    } else if (order.status === 'approved') {
      statusBadge = `<span class="badge-status approved">✓ Đã duyệt</span>`;
    } else {
      statusBadge = `<span class="badge-status cancelled">✕ Đã hủy</span>`;
    }

    return `
      <tr>
        <td><strong>${order.id}</strong></td>
        <td><span class="badge-tag">${order.platform}</span></td>
        <td><span style="font-weight:600;color:#1e293b">${order.productName}</span></td>
        <td>${formatVND(order.amount)}</td>
        <td style="color:#059669;font-weight:700">+${formatVND(order.cashback)}</td>
        <td style="color:#64748b;font-size:12px">${order.date}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

window.filterOrdersTable = function() {
  renderOrdersTable();
};

function renderWithdrawalsTable() {
  const tbody = document.getElementById('withdrawalsTableBody');
  if (!tbody) return;

  if (state.withdrawals.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:#94a3b8">Chưa có giao dịch rút tiền nào</td></tr>`;
    return;
  }

  tbody.innerHTML = state.withdrawals.map(w => {
    return `
      <tr>
        <td><strong>${w.id}</strong></td>
        <td>${w.bank}</td>
        <td>${w.accountNumber}</td>
        <td>${w.accountName}</td>
        <td style="color:#2563eb;font-weight:700">-${formatVND(w.amount)}</td>
        <td style="color:#64748b;font-size:12px">${w.date}</td>
        <td><span class="badge-status approved">✓ Chuyển thành công</span></td>
      </tr>
    `;
  }).join('');
}

// Render Leaderboard
function renderLeaderboard() {
  const homeTbody = document.getElementById('homeLeaderboardBody');
  const fullTbody = document.getElementById('fullLeaderboardBody');

  // Preview on home (Top 5)
  if (homeTbody) {
    homeTbody.innerHTML = LEADERBOARD_DATA.slice(0, 5).map(item => `
      <tr>
        <td>
          <span class="rank-badge ${item.rank === 1 ? 'rank-1-badge' : item.rank === 2 ? 'rank-2-badge' : item.rank === 3 ? 'rank-3-badge' : ''}">
            ${item.rank}
          </span>
        </td>
        <td>#${item.id}</td>
        <td><strong>${item.username}</strong></td>
        <td>${item.orders} đơn</td>
        <td style="color:#059669;font-weight:800">${formatVND(item.cashback)}</td>
        <td><span class="badge-tag" style="background:#fef3c7;color:#92400e">+${item.reward}</span></td>
      </tr>
    `).join('');
  }

  // Full table
  if (fullTbody) {
    fullTbody.innerHTML = LEADERBOARD_DATA.map(item => `
      <tr>
        <td>
          <span class="rank-badge ${item.rank === 1 ? 'rank-1-badge' : item.rank === 2 ? 'rank-2-badge' : item.rank === 3 ? 'rank-3-badge' : ''}">
            ${item.rank}
          </span>
        </td>
        <td>#${item.id}</td>
        <td><strong>${item.username}</strong></td>
        <td>${item.orders} đơn hoàn tất</td>
        <td style="color:#059669;font-weight:800">${formatVND(item.cashback)}</td>
        <td><span class="badge-tag" style="background:#fef3c7;color:#92400e">+${item.reward}</span></td>
      </tr>
    `).join('');
  }
}

// Render Deals Grid
function renderDeals(category = 'all', targetContainerId = 'dealsGrid') {
  const container = document.getElementById(targetContainerId);
  if (!container) return;

  let filtered = DEALS_DATA;
  if (category !== 'all') {
    if (category === 'shopee') filtered = DEALS_DATA.filter(d => d.platform === 'Shopee');
    else if (category === 'lazada') filtered = DEALS_DATA.filter(d => d.platform === 'Lazada');
    else if (category === '1k' || category === 'sale1k') filtered = DEALS_DATA.filter(d => d.category === 'sale1k');
    else if (category === 'tech') filtered = DEALS_DATA.filter(d => d.category === 'tech');
    else if (category === 'beauty') filtered = DEALS_DATA.filter(d => d.category === 'beauty');
  }

  container.innerHTML = filtered.map(deal => `
    <div class="deal-card">
      <div class="deal-thumb-wrapper">
        <span class="deal-badge-float">${deal.badge}</span>
        <img src="${deal.image}" alt="${deal.title}" loading="lazy">
        <span class="cashback-ribbon">Hoàn ${deal.cashbackPercent}</span>
      </div>
      <div class="deal-card-body">
        <h4 class="deal-title" title="${deal.title}">${deal.title}</h4>
        <div class="deal-price-row">
          <span class="current-price">${formatVND(deal.price)}</span>
          <span class="original-price">${formatVND(deal.originalPrice)}</span>
        </div>
        <button class="deal-btn-action" onclick="applyDealLink('${deal.link}')">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Lấy Link Hoàn ${formatVND(deal.cashbackVal)}
        </button>
      </div>
    </div>
  `).join('');
}

window.filterDeals = function(cat, evt) {
  document.querySelectorAll('#dealFilterPills .filter-pill').forEach(btn => btn.classList.remove('active'));
  const target = (evt && evt.target) || (typeof window !== 'undefined' && window.event && window.event.target);
  if (target && target.classList) {
    target.classList.add('active');
  }
  renderDeals(cat, 'dealsGrid');
};

window.filterDealsTab = function(cat, evt) {
  document.querySelectorAll('.deal-categories-chips .chip-filter').forEach(btn => btn.classList.remove('active'));
  const target = (evt && evt.target) || (typeof window !== 'undefined' && window.event && window.event.target);
  if (target && target.classList) {
    target.classList.add('active');
  }
  renderDeals(cat, 'fullDealsGrid');
};

window.quickFillPlatform = function(platform) {
  switchTab('home');
  fillSampleLink(platform.toLowerCase());
};

window.applyDealLink = function(url) {
  switchTab('home');
  document.getElementById('linkInput').value = url;
  scrollToConverter();
  handleConvertLink();
};

// ==================== STREAMING TICKER & LIVE NOTIFICATIONS ====================
function initLiveTicker() {
  const tickerEl = document.getElementById('announcementTicker');
  const recentPayoutListEl = document.getElementById('recentPayoutList');

  if (recentPayoutListEl) {
    recentPayoutListEl.innerHTML = MOCK_PAYOUT_TICKER.slice(0, 3).map(p => `
      <div class="payout-item">
        <span>🎉 Thành viên <strong>${p.user}</strong></span>
        <span>Rút <strong>${p.amount}</strong> (${p.bank})</span>
      </div>
    `).join('');
  }

  let index = 0;
  setInterval(() => {
    index = (index + 1) % MOCK_PAYOUT_TICKER.length;
    const item = MOCK_PAYOUT_TICKER[index];
    if (tickerEl) {
      tickerEl.innerHTML = `<span>🎉 Chúc mừng <strong>${item.user}</strong> vừa rút thành công <strong>${item.amount}</strong> về ${item.bank}!</span>`;
    }
  }, 4500);
}

// ==================== APP INITIALIZATION ====================
function initApp() {
  renderHeaderAndWallet();
  renderLeaderboard();
  renderDeals('all', 'dealsGrid');
  renderDeals('all', 'fullDealsGrid');
  initLiveTicker();
}

// Run on load
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});
