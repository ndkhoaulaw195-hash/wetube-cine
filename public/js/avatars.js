/**
 * wetube ciné - Chibi 16-bit Pixel Art Avatar Generator
 * Inspired by classic RPG / Stardew / Habbo Chibi Pixel Characters
 * Supports both 2D UI DataURLs and 3D Three.js NearestFilter Sprite Textures
 */

const PIXEL_AVATAR_TEMPLATES = [
  {
    id: 'pixel_nerd',
    name: 'Chàng IT Đeo Kính',
    desc: 'Sơ mi xanh cổ vịt, kính gọng vuông dày, chuẩn mọt phim công nghệ',
    badge: '🤓 IT / Mọt Sách',
    hairColor: '#1f2129',
    hairShade: '#14151a',
    skinColor: '#f4b89a',
    skinShade: '#dc9575',
    shirtColor: '#367582',
    shirtShade: '#24525c',
    pantsColor: '#252730',
    glasses: 'square',
    hairStyle: 'short_parted',
    expression: 'neutral',
    collar: 'open_teal',
    prop: null
  },
  {
    id: 'pixel_ceo',
    name: 'Tổng Tài Vest Đen',
    desc: 'Tóc nâu vuốt ngược, vest đen cà vạt đỏ lịch lãm, tay cầm ly cà phê',
    badge: '💼 Tổng Tài',
    hairColor: '#722c23',
    hairShade: '#4e1b15',
    skinColor: '#f4b89a',
    skinShade: '#dc9575',
    shirtColor: '#332424',
    shirtShade: '#211717',
    pantsColor: '#281d1d',
    glasses: null,
    hairStyle: 'slick_back',
    expression: 'serious',
    collar: 'suit_red_tie',
    prop: 'coffee'
  },
  {
    id: 'pixel_nurse',
    name: 'Nữ Y Tá Dịu Dàng',
    desc: 'Mũ y tá chữ thập xanh, tóc buộc đuôi ngựa, áo blouse trắng & ống nghe',
    badge: '🩺 Thiên Thần Áo Trắng',
    hairColor: '#632923',
    hairShade: '#421915',
    skinColor: '#f4b89a',
    skinShade: '#dc9575',
    shirtColor: '#e4eff2',
    shirtShade: '#b8ced6',
    pantsColor: '#f4b89a', // Skirt + legs
    isSkirt: true,
    skirtColor: '#cfe0e6',
    glasses: null,
    hat: 'nurse_cap',
    hairStyle: 'ponytail',
    expression: 'smile',
    collar: 'stethoscope',
    prop: null
  },
  {
    id: 'pixel_popcorn',
    name: 'Thánh Bắp Rang Bơ',
    desc: 'Mũ lưỡi trai đội ngược, áo hoodie cam vàng, ôm hộp bắp rang khổng lồ',
    badge: '🍿 Thánh Ăn Bắp',
    hairColor: '#3b2618',
    hairShade: '#26170e',
    skinColor: '#f4b89a',
    skinShade: '#dc9575',
    shirtColor: '#e88b2c',
    shirtShade: '#bf6915',
    pantsColor: '#2b3a4a',
    glasses: null,
    hat: 'cap_backwards',
    hairStyle: 'short_parted',
    expression: 'smile',
    collar: 'hoodie_strings',
    prop: 'popcorn'
  },
  {
    id: 'pixel_director',
    name: 'Đạo Diễn Điện Ảnh',
    desc: 'Mũ nồi beret đỏ, kính râm đen ngầu, áo khoác da & bảng phân cảnh phim',
    badge: '🎬 Đạo Diễn',
    hairColor: '#2c221e',
    hairShade: '#1a1412',
    skinColor: '#f0b090',
    skinShade: '#d48d6c',
    shirtColor: '#593a28',
    shirtShade: '#3d2619',
    pantsColor: '#24201e',
    glasses: 'sunglasses',
    hat: 'beret_red',
    hairStyle: 'short_parted',
    expression: 'serious',
    collar: 'scarf_gold',
    prop: 'clapper'
  },
  {
    id: 'pixel_gamer',
    name: 'Streamer Tai Mèo',
    desc: 'Tóc hồng pastel, tai nghe gaming tai mèo phát sáng, áo cyberpunk',
    badge: '🎧 Streamer',
    hairColor: '#f0789c',
    hairShade: '#c44d73',
    skinColor: '#f7c4aa',
    skinShade: '#df9d7e',
    shirtColor: '#6d4aff',
    shirtShade: '#4b2ec4',
    pantsColor: '#232038',
    glasses: null,
    hat: 'cat_headset',
    hairStyle: 'ponytail',
    expression: 'smile',
    collar: 'cyber_trim',
    prop: 'gamepad'
  },
  {
    id: 'pixel_detective',
    name: 'Thám Tử Sherlock',
    desc: 'Mũ phớt thám tử, áo măng tô nâu cổ điển, tay cầm kính lúp truy tìm',
    badge: '🕵️ Thám Tử',
    hairColor: '#453024',
    hairShade: '#2b1d15',
    skinColor: '#f4b89a',
    skinShade: '#dc9575',
    shirtColor: '#b88c5a',
    shirtShade: '#8f683d',
    pantsColor: '#423122',
    glasses: 'monocle',
    hat: 'fedora',
    hairStyle: 'slick_back',
    expression: 'serious',
    collar: 'suit_red_tie',
    prop: 'magnifier'
  },
  {
    id: 'pixel_chef',
    name: 'Bếp Trưởng Hoàng Gia',
    desc: 'Mũ đầu bếp trắng cao, khăn quàng cổ đỏ, áo bếp trưởng 2 hàng cúc',
    badge: '👨‍🍳 Bếp Trưởng',
    hairColor: '#362319',
    hairShade: '#21150f',
    skinColor: '#f4b89a',
    skinShade: '#dc9575',
    shirtColor: '#f2f5f7',
    shirtShade: '#cad4db',
    pantsColor: '#2c3038',
    glasses: null,
    hat: 'chef_hat',
    hairStyle: 'short_parted',
    expression: 'smile',
    collar: 'chef_scarf',
    prop: 'spoon_gold'
  },
  {
    id: 'pixel_wizard',
    name: 'Phù Thủy Ánh Sao',
    desc: 'Mũ phù thủy chóp nhọn viền vàng, áo choàng phép thuật & trượng pha lê',
    badge: '🔮 Pháp Sư',
    hairColor: '#d9e4f5',
    hairShade: '#9fb4d4',
    skinColor: '#f4b89a',
    skinShade: '#dc9575',
    shirtColor: '#4b2d82',
    shirtShade: '#311b59',
    pantsColor: '#231440',
    glasses: 'square',
    hat: 'wizard_hat',
    hairStyle: 'short_parted',
    expression: 'smile',
    collar: 'gold_robe',
    prop: 'wand'
  },
  {
    id: 'pixel_ninja',
    name: 'Ninja Bóng Đêm',
    desc: 'Khăn bịt mặt bí ẩn, băng trán đỏ rực, giáp Shinobi đêm khuya',
    badge: '🥷 Shinobi',
    hairColor: '#1b1d24',
    hairShade: '#101117',
    skinColor: '#f4b89a',
    skinShade: '#dc9575',
    shirtColor: '#25293a',
    shirtShade: '#171a26',
    pantsColor: '#171a26',
    glasses: null,
    hat: 'ninja_band',
    hairStyle: 'ninja_mask',
    expression: 'serious',
    collar: 'ninja_armor',
    prop: 'shuriken'
  },
  {
    id: 'pixel_idol',
    name: 'Idol Nhạc Pop',
    desc: 'Tóc vàng kim lấp lánh, nơ đỏ đáng yêu, váy biểu diễn & micro hồng',
    badge: '🎤 Ngôi Sao Idol',
    hairColor: '#f7cf52',
    hairShade: '#d4a324',
    skinColor: '#f7c4aa',
    skinShade: '#df9d7e',
    shirtColor: '#ec4899',
    shirtShade: '#be185d',
    pantsColor: '#f7c4aa',
    isSkirt: true,
    skirtColor: '#f472b6',
    glasses: null,
    hat: 'red_bow',
    hairStyle: 'ponytail',
    expression: 'smile',
    collar: 'idol_ribbon',
    prop: 'mic'
  },
  {
    id: 'pixel_king',
    name: 'Ông Hoàng Rạp VIP',
    desc: 'Vương miện vàng đính ngọc bích, áo choàng hoàng gia đỏ thẫm & quyền trượng',
    badge: '👑 Quốc Vương VIP',
    hairColor: '#5c2c1d',
    hairShade: '#3b1a10',
    skinColor: '#f4b89a',
    skinShade: '#dc9575',
    shirtColor: '#9e1c28',
    shirtShade: '#6e1019',
    pantsColor: '#2b181a',
    glasses: null,
    hat: 'crown_gold',
    hairStyle: 'slick_back',
    expression: 'serious',
    collar: 'royal_cape',
    prop: 'scepter'
  }
];

class PixelAvatarRenderer {
  constructor() {
    this.cache = new Map();
    this.templates = PIXEL_AVATAR_TEMPLATES;
  }

  getTemplate(avatarId, overrides = {}) {
    const base = this.templates.find(t => t.id === avatarId) || this.templates[0];
    return { ...base, ...overrides };
  }

  /**
   * Draw a 24x30 pixel-art chibi character onto a canvas context
   */
  drawChibiGrid(ctx, tpl, scale = 4) {
    const O = '#231514'; // Signature dark pixel outline from reference image
    const W = '#ffffff';

    const px = (x, y, color, w = 1, h = 1) => {
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, w * scale, h * scale);
    };

    // --- 1. PONYTAIL (Back layer if ponytail) ---
    if (tpl.hairStyle === 'ponytail') {
      px(3, 12, O, 3, 6);
      px(2, 13, O, 1, 4);
      px(3, 13, tpl.hairShade, 2, 4);
      px(4, 13, tpl.hairColor, 1, 3);
    }

    // --- 2. LEGS & SHOES (Rows 23..28) ---
    // Left leg & right leg outline
    px(7, 23, O, 10, 6);
    if (tpl.isSkirt) {
      // Skirt bottom + bare legs + cute shoes
      px(7, 22, O, 10, 2);
      px(8, 22, tpl.skirtColor, 8, 2);
      px(8, 24, tpl.skinColor, 3, 2);
      px(13, 24, tpl.skinColor, 3, 2);
      px(11, 24, O, 2, 5); // gap outline
      // Shoes
      px(7, 26, O, 4, 3);
      px(13, 26, O, 4, 3);
      px(8, 26, '#52241e', 3, 2);
      px(13, 26, '#52241e', 3, 2);
    } else {
      // Pants
      px(8, 23, tpl.pantsColor, 3, 4);
      px(13, 23, tpl.pantsColor, 3, 4);
      px(11, 24, O, 2, 5);
      // Shoes
      px(7, 27, O, 5, 2);
      px(12, 27, O, 5, 2);
      px(8, 27, '#42221b', 3, 1);
      px(13, 27, '#42221b', 3, 1);
    }

    // --- 3. TORSO & ARMS (Rows 16..23) ---
    // Outer torso + arms outline
    px(5, 16, O, 14, 7);
    px(6, 15, O, 12, 1);

    // Shirt body
    px(8, 16, tpl.shirtColor, 8, 7);
    px(8, 16, tpl.shirtShade, 1, 7);
    px(15, 16, tpl.shirtShade, 1, 7);

    // Sleeves (left & right)
    px(6, 16, tpl.shirtColor, 2, 4);
    px(16, 16, tpl.shirtColor, 2, 4);
    px(6, 19, tpl.shirtShade, 2, 1);
    px(16, 19, tpl.shirtShade, 2, 1);

    // Hands (left & right)
    px(6, 20, tpl.skinColor, 2, 2);
    px(6, 21, tpl.skinShade, 1, 1);
    px(16, 20, tpl.skinColor, 2, 2);
    px(17, 21, tpl.skinShade, 1, 1);
    // Arm divider lines
    px(7, 18, O, 1, 5);
    px(16, 18, O, 1, 5);

    // Collar / Outfit Details
    if (tpl.collar === 'open_teal') {
      // V-neck skin + collar flaps + belt
      px(11, 16, tpl.skinColor, 2, 2);
      px(10, 16, tpl.shirtShade, 1, 2);
      px(13, 16, tpl.shirtShade, 1, 2);
      px(11, 18, tpl.shirtShade, 1, 5);
      px(8, 22, '#1a1b22', 8, 1);
      px(11, 22, '#8b939c', 2, 1); // belt buckle
    } else if (tpl.collar === 'suit_red_tie') {
      // White dress shirt + red tie + suit lapels
      px(10, 16, W, 4, 4);
      px(11, 16, '#a82424', 2, 5); // red tie
      px(10, 16, O, 1, 5);
      px(13, 16, O, 1, 5);
    } else if (tpl.collar === 'stethoscope') {
      // Nurse stethoscope around neck
      px(11, 16, tpl.skinColor, 2, 1);
      px(9, 16, O, 1, 4);
      px(14, 16, O, 1, 4);
      px(10, 19, O, 4, 1);
      px(12, 20, O, 2, 2);
      px(12, 20, '#8fa3ad', 1, 1);
    } else if (tpl.collar === 'hoodie_strings') {
      px(10, 16, W, 1, 3);
      px(13, 16, W, 1, 3);
      px(9, 20, tpl.shirtShade, 6, 2);
    } else if (tpl.collar === 'scarf_gold') {
      px(9, 16, '#f2cf78', 6, 2);
      px(13, 18, '#d4a324', 2, 3);
    } else if (tpl.collar === 'cyber_trim') {
      px(9, 16, '#f472b6', 6, 1);
      px(11, 17, '#38bdf8', 2, 4);
    } else if (tpl.collar === 'chef_scarf') {
      px(9, 16, '#dc2626', 6, 2);
      px(10, 18, O, 1, 1);
      px(13, 18, O, 1, 1);
      px(10, 20, O, 1, 1);
      px(13, 20, O, 1, 1);
    } else if (tpl.collar === 'gold_robe') {
      px(10, 16, '#f2cf78', 4, 1);
      px(11, 17, '#f2cf78', 2, 6);
    } else if (tpl.collar === 'ninja_armor') {
      px(9, 16, '#dc2626', 6, 1);
      px(10, 17, '#3b4254', 4, 4);
    } else if (tpl.collar === 'idol_ribbon') {
      px(10, 16, W, 4, 2);
      px(11, 17, '#ef4444', 2, 2);
    } else if (tpl.collar === 'royal_cape') {
      px(8, 16, W, 8, 2);
      px(9, 16, O, 1, 1);
      px(12, 16, O, 1, 1);
      px(14, 16, O, 1, 1);
      px(11, 18, '#f2cf78', 2, 5);
    }

    // --- 4. HEAD, EARS & FACE (Rows 4..15) ---
    // Head outer outline
    px(6, 4, O, 12, 12);
    px(5, 6, O, 14, 9);
    // Ears (left & right)
    px(4, 9, O, 2, 4);
    px(18, 9, O, 2, 4);
    px(5, 10, tpl.skinShade, 1, 2);
    px(18, 10, tpl.skinShade, 1, 2);

    // Face skin fill
    px(6, 6, tpl.skinColor, 12, 9);
    px(6, 14, tpl.skinShade, 12, 1); // chin shadow
    px(6, 10, tpl.skinShade, 1, 4);

    // --- 5. HAIR & EXPRESSIONS ---
    if (tpl.hairStyle === 'short_parted') {
      // Classic short parted hair (like Reference #1)
      px(6, 4, tpl.hairColor, 12, 4);
      px(5, 6, tpl.hairColor, 2, 4);
      px(17, 6, tpl.hairColor, 2, 4);
      px(7, 8, tpl.hairShade, 2, 1);
      px(11, 8, tpl.hairShade, 2, 1);
      px(15, 8, tpl.hairShade, 2, 1);
      px(6, 4, tpl.hairShade, 4, 2);
    } else if (tpl.hairStyle === 'slick_back') {
      // Slicked back brown hair with receding temples (like Reference #2)
      px(6, 4, tpl.hairColor, 12, 3);
      px(5, 5, tpl.hairColor, 2, 4);
      px(17, 5, tpl.hairShade, 2, 4);
      px(6, 7, tpl.hairShade, 2, 2);
      px(8, 4, tpl.hairShade, 3, 1);
      px(13, 4, tpl.hairShade, 3, 1);
    } else if (tpl.hairStyle === 'ponytail') {
      // Side swept bangs (like Reference #3)
      px(6, 4, tpl.hairColor, 12, 4);
      px(5, 6, tpl.hairColor, 3, 4);
      px(16, 6, tpl.hairColor, 3, 4);
      px(8, 8, tpl.hairColor, 6, 1);
      px(13, 8, tpl.hairShade, 4, 2);
    } else if (tpl.hairStyle === 'ninja_mask') {
      px(6, 4, tpl.hairColor, 12, 4);
      // Mask covering lower face
      px(6, 11, '#1b1d24', 12, 4);
      px(6, 11, O, 12, 1);
    }

    // Eyes, Eyebrows & Mouth
    if (tpl.glasses === 'square') {
      // Thick black square glasses (exact match to Reference #1)
      px(7, 9, O, 5, 4);
      px(13, 9, O, 5, 4);
      px(12, 10, O, 1, 1); // bridge
      px(6, 10, O, 1, 1); // temple arm
      // Lenses & pupils
      px(8, 10, tpl.skinColor, 3, 2);
      px(14, 10, tpl.skinColor, 3, 2);
      px(9, 10, O, 1, 2); // left pupil
      px(15, 10, O, 1, 2); // right pupil
    } else if (tpl.glasses === 'sunglasses') {
      px(6, 9, O, 12, 1);
      px(7, 9, '#111111', 5, 3);
      px(13, 9, '#111111', 5, 3);
      px(8, 10, W, 2, 1);
      px(14, 10, W, 2, 1);
    } else if (tpl.glasses === 'glasses_3d') {
      // Kính 3D rạp chiếu thời trang: tròng trái đỏ, tròng phải xanh Cyan
      px(6, 9, '#ffffff', 12, 1);
      px(7, 9, '#ef4444', 5, 3); // Lense Đỏ
      px(13, 9, '#06b6d4', 5, 3); // Lense Xanh Cyan
      px(12, 10, '#ffffff', 1, 1); // Cầu nối kính
      px(8, 10, '#fca5a5', 2, 1);
      px(14, 10, '#a5f3fc', 2, 1);
    } else {
      // Standard expressive eyes
      if (tpl.expression === 'serious') {
        // Furrowed eyebrows + sharp eyes (exact match to Reference #2)
        px(8, 9, O, 3, 1);
        px(10, 10, O, 1, 1);
        px(14, 9, O, 3, 1);
        px(13, 10, O, 1, 1);
        px(9, 10, O, 2, 2);
        px(14, 10, O, 2, 2);
      } else {
        // Cute vertical eyes (exact match to Reference #3)
        px(9, 9, '#4a251d', 2, 1);
        px(15, 9, '#4a251d', 2, 1);
        px(9, 10, O, 2, 2);
        px(15, 10, O, 2, 2);
      }
    }

    // Mouth & Nose (if not masked)
    if (tpl.hairStyle !== 'ninja_mask') {
      px(12, 12, tpl.skinShade, 2, 1); // cute nose shadow
      if (tpl.expression === 'smile') {
        px(10, 13, '#8c4436', 1, 1);
        px(11, 14, '#8c4436', 3, 1);
        px(14, 13, '#8c4436', 1, 1);
      } else {
        px(10, 13, O, 4, 1);
      }
    }

    // --- 6. HATS & HEADGEAR (Top layer) ---
    if (tpl.hat === 'nurse_cap') {
      // White nurse cap with green cross (exact match to Reference #3)
      px(7, 1, O, 10, 5);
      px(8, 2, W, 8, 4);
      // Green cross
      px(11, 2, '#58a769', 2, 4);
      px(10, 3, '#58a769', 4, 2);
    } else if (tpl.hat === 'cap_backwards') {
      px(6, 2, O, 12, 4);
      px(7, 3, '#2563eb', 10, 3);
      px(4, 5, O, 4, 2);
      px(4, 5, '#1d4ed8', 3, 1);
    } else if (tpl.hat === 'beret_red') {
      px(5, 2, O, 13, 4);
      px(6, 3, '#dc2626', 11, 3);
      px(7, 2, '#ef4444', 8, 1);
    } else if (tpl.hat === 'cat_headset') {
      // Glowing cat ear headphones
      px(5, 2, O, 3, 3);
      px(16, 2, O, 3, 3);
      px(6, 3, '#f472b6', 1, 2);
      px(17, 3, '#f472b6', 1, 2);
      px(4, 8, O, 2, 5);
      px(18, 8, O, 2, 5);
      px(4, 9, '#ec4899', 1, 3);
      px(19, 9, '#ec4899', 1, 3);
    } else if (tpl.hat === 'fedora') {
      px(4, 4, O, 16, 2);
      px(6, 1, O, 12, 4);
      px(7, 2, '#785233', 10, 3);
      px(7, 4, '#3d2616', 10, 1);
    } else if (tpl.hat === 'chef_hat') {
      px(6, 0, O, 12, 6);
      px(7, 1, W, 10, 4);
      px(8, 4, '#d1d5db', 8, 1);
    } else if (tpl.hat === 'wizard_hat') {
      px(3, 5, O, 18, 2);
      px(6, 3, O, 12, 3);
      px(8, 1, O, 8, 3);
      px(10, 0, O, 4, 2);
      px(7, 3, '#4c2a70', 10, 2);
      px(9, 1, '#4c2a70', 6, 2);
      px(7, 5, '#f2cf78', 10, 1);
    } else if (tpl.hat === 'ninja_band') {
      px(5, 6, '#dc2626', 14, 2);
      px(3, 7, '#dc2626', 2, 2);
      px(10, 6, '#9ca3af', 4, 2);
    } else if (tpl.hat === 'red_bow') {
      px(8, 2, O, 8, 3);
      px(9, 2, '#ef4444', 2, 3);
      px(13, 2, '#ef4444', 2, 3);
      px(11, 3, '#b91c1c', 2, 1);
    } else if (tpl.hat === 'crown_gold') {
      px(6, 1, O, 12, 5);
      px(7, 2, '#f2cf78', 10, 3);
      px(8, 1, '#f2cf78', 2, 1);
      px(11, 1, '#f2cf78', 2, 1);
      px(14, 1, '#f2cf78', 2, 1);
      px(9, 3, '#ef4444', 2, 1);
      px(13, 3, '#10b981', 2, 1);
    } else if (tpl.hat === 'party_hat') {
      // Mũ tiệc sinh nhật chóp nón sọc đỏ vàng
      px(9, 0, '#ef4444', 6, 2);
      px(10, 2, '#facc15', 4, 2);
      px(8, 4, '#38bdf8', 8, 2);
      px(11, 0, '#ffffff', 2, 1); // Quả bông trên đỉnh
    }

    // --- 7. HAND PROPS (Right side of character, like Reference #2 holding drink) ---
    if (tpl.prop === 'coffee') {
      px(18, 17, O, 4, 5);
      px(19, 18, '#d6b48d', 2, 3);
      px(19, 19, '#6e4726', 2, 1);
    } else if (tpl.prop === 'popcorn') {
      px(17, 16, O, 5, 6);
      px(18, 16, '#facc15', 3, 2);
      px(18, 18, '#ef4444', 1, 3);
      px(19, 18, W, 1, 3);
      px(20, 18, '#ef4444', 1, 3);
    } else if (tpl.prop === 'milktea') {
      // Ly trà sữa trân châu hoàng kim
      px(18, 16, O, 4, 6);
      px(19, 17, '#fcd34d', 2, 4); // Màu trà sữa
      px(19, 20, '#1f2937', 2, 1); // Trân châu đáy ly
      px(20, 15, '#ec4899', 1, 3); // Ống hút hồng
    } else if (tpl.prop === 'soda') {
      // Ly nước ngọt có ga rạp phim
      px(18, 16, O, 4, 6);
      px(19, 17, '#dc2626', 2, 4); // Ly đỏ
      px(19, 15, '#ffffff', 1, 3); // Ống hút trắng
    } else if (tpl.prop === 'clapper') {
      px(18, 17, O, 5, 4);
      px(19, 17, W, 3, 1);
      px(19, 18, '#1f2937', 3, 2);
    } else if (tpl.prop === 'gamepad') {
      px(18, 18, O, 4, 3);
      px(19, 19, '#e2e8f0', 2, 1);
    } else if (tpl.prop === 'magnifier') {
      px(18, 16, O, 4, 4);
      px(19, 17, '#93c5fd', 2, 2);
      px(19, 20, O, 1, 2);
    } else if (tpl.prop === 'spoon_gold' || tpl.prop === 'wand' || tpl.prop === 'scepter') {
      px(19, 13, O, 3, 9);
      px(20, 14, '#f2cf78', 1, 7);
      px(19, 13, '#38bdf8', 3, 2);
    } else if (tpl.prop === 'mic') {
      px(18, 16, O, 3, 5);
      px(19, 16, '#f472b6', 1, 2);
      px(19, 18, '#374151', 1, 3);
    }
  }

  /**
   * Draw the back of a 24x30 pixel-art chibi character (viewed from behind when seated)
   */
  drawChibiGridBack(ctx, tpl, scale = 4) {
    const O = '#231514'; // Signature dark pixel outline
    const W = '#ffffff';

    const px = (x, y, color, w = 1, h = 1) => {
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, w * scale, h * scale);
    };

    // --- 1. LEGS & SHOES (Rows 23..28) ---
    px(7, 23, O, 10, 6);
    if (tpl.isSkirt) {
      px(7, 22, O, 10, 2);
      px(8, 22, tpl.skirtColor, 8, 2);
      px(8, 24, tpl.skinColor, 3, 2);
      px(13, 24, tpl.skinColor, 3, 2);
      px(11, 24, O, 2, 5);
      px(7, 26, O, 4, 3);
      px(13, 26, O, 4, 3);
      px(8, 26, '#52241e', 3, 2);
      px(13, 26, '#52241e', 3, 2);
    } else {
      px(8, 23, tpl.pantsColor, 3, 4);
      px(13, 23, tpl.pantsColor, 3, 4);
      px(11, 24, O, 2, 5);
      px(7, 27, O, 5, 2);
      px(12, 27, O, 5, 2);
      px(8, 27, '#42221b', 3, 1);
      px(13, 27, '#42221b', 3, 1);
    }

    // --- 2. TORSO & ARMS FROM BEHIND (Rows 15..23) ---
    px(5, 16, O, 14, 7);
    px(6, 15, O, 12, 1);

    // Solid shirt back (no front buttons or open collar)
    px(8, 16, tpl.shirtColor, 8, 7);
    px(8, 16, tpl.shirtShade, 1, 7);
    px(15, 16, tpl.shirtShade, 1, 7);

    // Sleeves
    px(6, 16, tpl.shirtColor, 2, 4);
    px(16, 16, tpl.shirtColor, 2, 4);
    px(6, 19, tpl.shirtShade, 2, 1);
    px(16, 19, tpl.shirtShade, 2, 1);

    // Hands
    px(6, 20, tpl.skinColor, 2, 2);
    px(6, 21, tpl.skinShade, 1, 1);
    px(16, 20, tpl.skinColor, 2, 2);
    px(17, 21, tpl.skinShade, 1, 1);
    px(7, 18, O, 1, 5);
    px(16, 18, O, 1, 5);

    // Back collar & outfit accents
    if (tpl.collar === 'royal_cape') {
      px(7, 16, O, 10, 8);
      px(8, 16, '#991b1b', 8, 7);
      px(9, 17, '#dc2626', 6, 6);
    } else if (tpl.collar === 'hoodie_strings') {
      px(9, 16, tpl.shirtShade, 6, 3);
      px(10, 16, O, 4, 1);
    } else if (tpl.collar === 'chef_scarf') {
      px(9, 16, '#dc2626', 6, 2);
      px(11, 17, '#b91c1c', 2, 2);
    }

    // --- 3. HEAD & EARS FROM BEHIND (Rows 4..15) ---
    px(6, 4, O, 12, 12);
    px(5, 6, O, 14, 9);

    // Ears
    px(4, 9, O, 2, 4);
    px(18, 9, O, 2, 4);
    px(5, 10, tpl.skinShade, 1, 2);
    px(18, 10, tpl.skinShade, 1, 2);

    // Full back of hair
    px(6, 4, tpl.hairColor, 12, 11);
    px(5, 6, tpl.hairColor, 14, 8);
    px(6, 12, tpl.hairShade, 12, 3);
    px(5, 8, tpl.hairShade, 2, 6);
    px(17, 8, tpl.hairShade, 2, 6);
    px(9, 6, tpl.hairShade, 6, 2);

    if (tpl.hairStyle === 'ponytail') {
      px(10, 10, O, 4, 7);
      px(11, 10, tpl.hairColor, 2, 6);
      px(10, 8, '#ec4899', 4, 2);
      px(11, 8, '#f472b6', 2, 1);
    }

    // --- 4. HATS & HEADGEAR FROM BEHIND ---
    if (tpl.hat === 'nurse_cap') {
      px(7, 1, O, 10, 5);
      px(8, 2, W, 8, 4);
    } else if (tpl.hat === 'cap_backwards') {
      // Snapback cap facing backward (visor visible to viewer behind)
      px(6, 2, O, 12, 4);
      px(7, 3, '#2563eb', 10, 3);
      px(7, 6, O, 10, 2);
      px(8, 6, '#1d4ed8', 8, 1);
    } else if (tpl.hat === 'beret_red') {
      px(5, 2, O, 13, 4);
      px(6, 3, '#dc2626', 11, 3);
      px(7, 2, '#ef4444', 8, 1);
    } else if (tpl.hat === 'cat_headset') {
      px(5, 2, O, 3, 3);
      px(16, 2, O, 3, 3);
      px(6, 3, '#f472b6', 1, 2);
      px(17, 3, '#f472b6', 1, 2);
      px(4, 8, O, 2, 5);
      px(18, 8, O, 2, 5);
      px(7, 5, '#ec4899', 10, 2);
    } else if (tpl.hat === 'fedora') {
      px(4, 4, O, 16, 2);
      px(6, 1, O, 12, 4);
      px(7, 2, '#785233', 10, 3);
      px(7, 4, '#3d2616', 10, 1);
    } else if (tpl.hat === 'chef_hat') {
      px(6, 0, O, 12, 6);
      px(7, 1, W, 10, 4);
      px(8, 4, '#d1d5db', 8, 1);
    } else if (tpl.hat === 'wizard_hat') {
      px(3, 5, O, 18, 2);
      px(6, 3, O, 12, 3);
      px(8, 1, O, 8, 3);
      px(10, 0, O, 4, 2);
      px(7, 3, '#4c2a70', 10, 2);
      px(9, 1, '#4c2a70', 6, 2);
      px(7, 5, '#f2cf78', 10, 1);
    } else if (tpl.hat === 'ninja_band') {
      px(5, 6, '#dc2626', 14, 2);
      px(11, 7, '#dc2626', 2, 5);
      px(13, 8, '#991b1b', 2, 4);
    } else if (tpl.hat === 'red_bow') {
      px(8, 2, O, 8, 3);
      px(9, 2, '#ef4444', 2, 3);
      px(13, 2, '#ef4444', 2, 3);
    } else if (tpl.hat === 'crown_gold') {
      px(6, 1, O, 12, 5);
      px(7, 2, '#f2cf78', 10, 3);
      px(8, 1, '#f2cf78', 2, 1);
      px(11, 1, '#f2cf78', 2, 1);
      px(14, 1, '#f2cf78', 2, 1);
    } else if (tpl.hat === 'party_hat') {
      px(9, 0, '#ef4444', 6, 2);
      px(10, 2, '#facc15', 4, 2);
      px(8, 4, '#38bdf8', 8, 2);
      px(11, 0, '#ffffff', 2, 1);
    }

    // --- 5. PROPS (Mirrored to other side when seen from behind) ---
    if (tpl.prop === 'coffee') {
      px(2, 17, O, 4, 5);
      px(3, 18, '#d6b48d', 2, 3);
    } else if (tpl.prop === 'popcorn') {
      px(2, 16, O, 5, 6);
      px(3, 16, '#facc15', 3, 2);
      px(3, 18, '#ef4444', 1, 3);
      px(4, 18, W, 1, 3);
      px(5, 18, '#ef4444', 1, 3);
    } else if (tpl.prop === 'milktea') {
      px(2, 16, O, 4, 6);
      px(3, 17, '#fcd34d', 2, 4);
      px(3, 20, '#1f2937', 2, 1);
      px(4, 15, '#ec4899', 1, 3);
    } else if (tpl.prop === 'soda') {
      px(2, 16, O, 4, 6);
      px(3, 17, '#dc2626', 2, 4);
      px(3, 15, '#ffffff', 1, 3);
    }
  }

  /**
   * Returns a cached DataURL of the pixel character for <img> tags
   */
  getDataUrl(avatarId = 'pixel_nerd', scale = 5, overrides = {}, isBackView = false) {
    const tpl = this.getTemplate(avatarId, overrides);
    const cacheKey = `${tpl.id}_${scale}_${isBackView ? 'back' : 'front'}_${JSON.stringify(overrides)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 24 * scale;
    canvas.height = 30 * scale;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    if (isBackView) {
      this.drawChibiGridBack(ctx, tpl, scale);
    } else {
      this.drawChibiGrid(ctx, tpl, scale);
    }

    const url = canvas.toDataURL('image/png');
    this.cache.set(cacheKey, url);
    return url;
  }

  /**
   * Creates a high-res pixelated Canvas for Three.js Texture
   */
  createSpriteCanvas(avatarId = 'pixel_nerd', overrides = {}, isBackView = false) {
    const tpl = this.getTemplate(avatarId, overrides);
    const scale = 8;
    const canvas = document.createElement('canvas');
    canvas.width = 24 * scale;
    canvas.height = 30 * scale;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (isBackView) {
      this.drawChibiGridBack(ctx, tpl, scale);
    } else {
      this.drawChibiGrid(ctx, tpl, scale);
    }
    return canvas;
  }
}

window.PixelAvatars = new PixelAvatarRenderer();
