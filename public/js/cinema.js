/**
 * wetube ciné mini - 3D Cinema Theater Engine (Three.js + CSS3D)
 * Built for 10-person VIP cinema hall with real users
 */

class CinemaScene {
  constructor(containerId, cssContainerId, startPaused = false) {
    this.container = document.getElementById(containerId);
    this.cssContainer = document.getElementById(cssContainerId);

    this.scene = null;
    this.cssScene = null;
    this.camera = null;
    this.renderer = null;
    this.cssRenderer = null;
    this.cssScreenObject = null;
    this.hasWebGL = false;
    this.isPaused = !!startPaused;
    this.animationFrameId = null;
    this.lastHoverCheck = 0;
    this.wasPausedByTab = false;

    // Adaptive FPS State (60 FPS on movement/events, 24 FPS when idle watching movie)
    this.lastRenderTime = 0;
    this.lastActiveTime = performance.now();
    this.currentMySeatId = null;

    // Quality setting: 'high' | 'smooth'
    this.quality = 'smooth';
    this.partyMode = false;
    this.lightsOff = false;

    // Camera state & targets for smooth interpolation (lerp)
    this.cameraMode = 'overview'; // 'overview' | 'seat' | 'screen' | 'audience'
    this.camTargetPos = new THREE.Vector3(0, 9.4, 12.2);
    this.camTargetLook = new THREE.Vector3(0, 4.8, -2.2);
    this.camCurrentLook = new THREE.Vector3(0, 4.8, -2.2);
    this.isDollyActive = false;

    // Mouse drag orbit offsets
    this.mouseOffsetX = 0;
    this.mouseOffsetY = 0;
    this.targetMouseX = 0;
    this.targetMouseY = 0;
    this.isDragging = false;
    this.lastMousePos = { x: 0, y: 0 };

    // 16 Seats Coordinates across 3 Terraced Stadium Tiers:
    // Tier 1 (Hàng A): 5 front standard seats (floor y = 0.2, seats y = 0.25, z = -3.5)
    // Tier 2 (Hàng B): 5 middle VIP red velvet seats (+0.7m step, floor y = 0.9, seats y = 0.95, z = 0.0)
    // Tier 3 (Hàng C): 3 back Sweetbox couple sofas (+0.7m step, floor y = 1.6, seats y = 1.65, z = 3.6), each seating 2 people (6 seats C01..C06)
    this.seatCoords = [
      { id: 0, label: 'A01', x: -4.8, y: 0.25, z: -3.5 },
      { id: 1, label: 'A02', x: -2.4, y: 0.25, z: -3.5 },
      { id: 2, label: 'A03', x: 0.0,  y: 0.25, z: -3.5 },
      { id: 3, label: 'A04', x: 2.4,  y: 0.25, z: -3.5 },
      { id: 4, label: 'A05', x: 4.8,  y: 0.25, z: -3.5 },
      { id: 5, label: 'B01', x: -4.8, y: 0.95, z: 0.0 },
      { id: 6, label: 'B02', x: -2.4, y: 0.95, z: 0.0 },
      { id: 7, label: 'B03', x: 0.0,  y: 0.95, z: 0.0 },
      { id: 8, label: 'B04', x: 2.4,  y: 0.95, z: 0.0 },
      { id: 9, label: 'B05', x: 4.8,  y: 0.95, z: 0.0 },
      // Ghế Đôi 1 (Sofa 1 Trái, tâm x = -4.5): 2 chỗ ngồi cạnh nhau C01 (Trái) & C02 (Phải)
      { id: 10, label: 'C01', x: -5.05, y: 1.65, z: 3.6, isCouple: true, coupleGroup: 1, coupleSide: 'Trái', sofaCenterX: -4.5 },
      { id: 11, label: 'C02', x: -3.95, y: 1.65, z: 3.6, isCouple: true, coupleGroup: 1, coupleSide: 'Phải', sofaCenterX: -4.5 },
      // Ghế Đôi 2 (Sofa 2 Giữa, tâm x = 0.0): 2 chỗ ngồi cạnh nhau C03 (Trái) & C04 (Phải)
      { id: 12, label: 'C03', x: -0.55, y: 1.65, z: 3.6, isCouple: true, coupleGroup: 2, coupleSide: 'Trái', sofaCenterX: 0.0 },
      { id: 13, label: 'C04', x: 0.55,  y: 1.65, z: 3.6, isCouple: true, coupleGroup: 2, coupleSide: 'Phải', sofaCenterX: 0.0 },
      // Ghế Đôi 3 (Sofa 3 Phải, tâm x = 4.5): 2 chỗ ngồi cạnh nhau C05 (Trái) & C06 (Phải)
      { id: 14, label: 'C05', x: 3.95,  y: 1.65, z: 3.6, isCouple: true, coupleGroup: 3, coupleSide: 'Trái', sofaCenterX: 4.5 },
      { id: 15, label: 'C06', x: 5.05,  y: 1.65, z: 3.6, isCouple: true, coupleGroup: 3, coupleSide: 'Phải', sofaCenterX: 4.5 }
    ];

    // Meshes references
    this.seatMeshes = [];      // 16 seats
    this.exitDoorMeshes = [];  // Interactive Exit Doors
    this.avatarMeshes = [];    // 16 seated avatars
    this.stageAvatar = null;   // Avatar on stage
    this.couplePlaques = {};   // Plaque canvases for couple sofas
    this.coupleActionTimeouts = {};
    this.discoBallGroup = null;
    this.spotlights = [];
    this.laserBeams = [];
    this.floatingParticles = [];

    // Raycasting for interactive seat clicking
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredSeat = null;

    // Callbacks
    this.onSeatClick = null;
    this.onExitDoorClick = null;

    this.clock = new THREE.Clock();
    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 1. WebGL Scene & Camera
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    this.camera.position.set(0, 9.4, 12.2);
    this.camera.lookAt(this.camCurrentLook);

    // 2. Optimized Ultra-Smooth WebGL Renderer
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
        precision: 'mediump',
        stencil: false
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      this.renderer.shadowMap.enabled = false;
      this.container.appendChild(this.renderer.domElement);
      this.hasWebGL = true;
    } catch (e1) {
      try {
        this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(1);
        this.container.appendChild(this.renderer.domElement);
        this.hasWebGL = true;
      } catch (e2) {
        console.warn('WebGL không khả dụng, chuyển sang chế độ phẳng:', e2);
        this.hasWebGL = false;
      }
    }

    // 3. CSS3D Renderer (For embedding synced YouTube screen in 3D space)
    if (typeof THREE.CSS3DRenderer !== 'undefined') {
      this.cssScene = new THREE.Scene();
      this.cssRenderer = new THREE.CSS3DRenderer();
      this.cssRenderer.setSize(width, height);
      this.cssRenderer.domElement.style.position = 'absolute';
      this.cssRenderer.domElement.style.top = '0';
      this.cssRenderer.domElement.style.left = '0';
      this.cssRenderer.domElement.style.width = '100%';
      this.cssRenderer.domElement.style.height = '100%';
      this.cssRenderer.domElement.style.pointerEvents = 'none';
      this.cssContainer.appendChild(this.cssRenderer.domElement);
    }

    if (this.hasWebGL) {
      this.buildTheaterEnvironment();
      this.buildSeats();
      this.buildDiscoBallAndLights();
    }

    this.buildScreenAndCSS3D();

    // Event Listeners
    window.addEventListener('resize', () => this.onWindowResize(), { passive: true });
    this.container.addEventListener('pointerdown', (e) => this.onPointerDown(e), { passive: true });
    this.container.addEventListener('pointermove', (e) => this.onPointerMove(e), { passive: true });
    this.container.addEventListener('pointerup', (e) => this.onPointerUp(e), { passive: true });
    this.container.addEventListener('click', (e) => this.onClick(e));

    // Pause when tab is hidden to save 100% background CPU
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (!this.isPaused) {
          this.wasPausedByTab = true;
          this.pause();
        }
      } else if (this.wasPausedByTab) {
        this.wasPausedByTab = false;
        this.resume();
      }
    });

    // Animation Loop
    if (!this.isPaused) {
      this.animate();
    }
  }

  buildTheaterEnvironment() {
    const hallWidth = 21;
    const hallLength = 26;
    const hallHeight = 12.2;

    this.floorMat = new THREE.MeshStandardMaterial({
      color: 0x161816,
      roughness: 0.85,
      metalness: 0.1
    });

    this.wallMat = new THREE.MeshStandardMaterial({
      color: 0x111311,
      roughness: 0.9,
      metalness: 0.15
    });

    const woodStageMat = new THREE.MeshStandardMaterial({
      color: 0x241d17,
      roughness: 0.45,
      metalness: 0.2
    });

    this.goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf2cf78,
      roughness: 0.3,
      metalness: 0.8,
      emissive: 0x705218,
      emissiveIntensity: 0.22
    });

    // 1. Tiered Cinema Floor (Bậc thang rạp chiếu phim 3 tầng thật - Chuẩn Stadium Seating)
    this.stepStripMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b }); // Glowing amber-gold step safety LED
    const stepFaceMat = new THREE.MeshStandardMaterial({ color: 0x181a18, roughness: 0.8, metalness: 0.2 });

    // TIER 1: Hàng A (Phía trước, sàn cao độ y = 0.2)
    const tier1Geo = new THREE.BoxGeometry(hallWidth, 0.4, 3.8);
    const tier1 = new THREE.Mesh(tier1Geo, this.floorMat);
    tier1.position.set(0, 0.0, -3.7);
    tier1.receiveShadow = true;
    this.scene.add(tier1);

    // BẬC THANG 1 (Riser 1: Bước từ Hàng A lên Hàng B cao thêm +0.7m):
    const riser1FaceGeo = new THREE.BoxGeometry(hallWidth, 0.72, 0.12);
    const riser1Face = new THREE.Mesh(riser1FaceGeo, stepFaceMat);
    riser1Face.position.set(0, 0.55, -1.8);
    this.scene.add(riser1Face);

    // Dải đèn LED vàng hắt chân bậc thang 1
    const strip1Geo = new THREE.BoxGeometry(hallWidth, 0.06, 0.08);
    const strip1 = new THREE.Mesh(strip1Geo, this.stepStripMat);
    strip1.position.set(0, 0.91, -1.74);
    this.scene.add(strip1);

    // TIER 2: Hàng B - Ghế VIP (Tầng giữa, sàn cao độ y = 0.9)
    const tier2Geo = new THREE.BoxGeometry(hallWidth, 0.72, 3.6);
    const tier2 = new THREE.Mesh(tier2Geo, this.floorMat);
    tier2.position.set(0, 0.54, 0.0);
    tier2.receiveShadow = true;
    this.scene.add(tier2);

    // BẬC THANG 2 (Riser 2: Bước từ Hàng B lên Hàng C cao thêm +0.7m):
    const riser2FaceGeo = new THREE.BoxGeometry(hallWidth, 0.72, 0.12);
    const riser2Face = new THREE.Mesh(riser2FaceGeo, stepFaceMat);
    riser2Face.position.set(0, 1.25, 1.8);
    this.scene.add(riser2Face);

    // Dải đèn LED vàng hắt chân bậc thang 2
    const strip2Geo = new THREE.BoxGeometry(hallWidth, 0.06, 0.08);
    const strip2 = new THREE.Mesh(strip2Geo, this.stepStripMat);
    strip2.position.set(0, 1.61, 1.86);
    this.scene.add(strip2);

    // TIER 3: Hàng C - Ghế Đôi Sweetbox (Tầng cao nhất, sàn cao độ y = 1.6)
    const tier3Geo = new THREE.BoxGeometry(hallWidth, 1.44, 11.7);
    const tier3 = new THREE.Mesh(tier3Geo, this.floorMat);
    tier3.position.set(0, 0.88, 7.65);
    tier3.receiveShadow = true;
    this.scene.add(tier3);

    // 2. Front Stage Platform in front of screen (low profile so stage dancers never cover screen)
    const stageGeo = new THREE.BoxGeometry(15.2, 0.36, 3.6);
    const stage = new THREE.Mesh(stageGeo, woodStageMat);
    stage.position.set(0, 0.12, -6.2);
    stage.receiveShadow = true;
    this.scene.add(stage);

    // Stage Front Edge Neon Gold Accent
    const stageEdgeGeo = new THREE.BoxGeometry(15.25, 0.06, 0.07);
    this.stageEdgeMat = new THREE.MeshBasicMaterial({ color: 0xf2cf78 });
    const stageEdge = new THREE.Mesh(stageEdgeGeo, this.stageEdgeMat);
    stageEdge.position.set(0, 0.31, -4.4);
    this.scene.add(stageEdge);

    // 3. Walls & Ceiling
    const backWallGeo = new THREE.BoxGeometry(hallWidth + 2, hallHeight, 0.5);
    const backWall = new THREE.Mesh(backWallGeo, this.wallMat);
    backWall.position.set(0, hallHeight / 2 - 0.2, -10.5);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    const rearWall = new THREE.Mesh(backWallGeo, this.wallMat);
    rearWall.position.set(0, hallHeight / 2 - 0.2, 13.5);
    this.scene.add(rearWall);

    const sideWallGeo = new THREE.BoxGeometry(0.5, hallHeight, hallLength);
    const leftWall = new THREE.Mesh(sideWallGeo, this.wallMat);
    leftWall.position.set(-hallWidth / 2, hallHeight / 2 - 0.2, 0);
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, this.wallMat);
    rightWall.position.set(hallWidth / 2, hallHeight / 2 - 0.2, 0);
    this.scene.add(rightWall);

    // Decorative wall ribs
    for (let z = -7; z <= 10; z += 3.5) {
      const ribGeo = new THREE.BoxGeometry(0.2, hallHeight - 2, 1.2);
      const ribLeft = new THREE.Mesh(ribGeo, this.goldTrimMat);
      ribLeft.position.set(-hallWidth / 2 + 0.25, hallHeight / 2, z);
      this.scene.add(ribLeft);

      const ribRight = new THREE.Mesh(ribGeo, this.goldTrimMat);
      ribRight.position.set(hallWidth / 2 - 0.25, hallHeight / 2, z);
      this.scene.add(ribRight);
    }

    const ceilingGeo = new THREE.BoxGeometry(hallWidth + 2, 0.4, hallLength);
    const ceiling = new THREE.Mesh(ceilingGeo, this.wallMat);
    ceiling.position.set(0, hallHeight, 0);
    this.scene.add(ceiling);

    // 4. Cinema Professional Sound System (Dolby Atmos Wall Surround Speakers & Stage Subwoofer Arrays)
    this.buildCinemaSoundSystem(hallWidth, hallLength, hallHeight);

    // 5. Cinema Emergency Exit Doors with Glowing Neon Sign (Cửa Thoát Hiểm / Out Phòng)
    this.buildExitDoors(hallWidth, hallLength, hallHeight);

    // Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.46);
    this.scene.add(this.ambientLight);

    this.warmKeyLight = new THREE.DirectionalLight(0xfff1d6, 0.65);
    this.warmKeyLight.position.set(0, 10, 5);
    this.scene.add(this.warmKeyLight);
  }

  // Dàn Loa Rạp Chiếu Phim Chuyên Nghiệp (Dolby Atmos Wall Surround Speakers & Stage Subwoofer Arrays)
  buildCinemaSoundSystem(hallWidth = 21, hallLength = 26, hallHeight = 12.2) {
    this.subwooferMeshes = [];
    this.soundMeterLeds = [];

    const cabinetMat = new THREE.MeshStandardMaterial({
      color: 0x0c0d0c,
      roughness: 0.7,
      metalness: 0.3
    });

    const coneMat = new THREE.MeshStandardMaterial({
      color: 0x181a18,
      roughness: 0.45,
      metalness: 0.55
    });

    const surroundConeMat = new THREE.MeshStandardMaterial({
      color: 0x242624,
      roughness: 0.3,
      metalness: 0.7
    });

    const dustCapMat = new THREE.MeshStandardMaterial({
      color: 0xd4d8dc,
      roughness: 0.25,
      metalness: 0.9
    });

    const hornMat = new THREE.MeshStandardMaterial({
      color: 0x141614,
      roughness: 0.6,
      metalness: 0.4
    });

    const goldTrim = new THREE.MeshStandardMaterial({
      color: 0xf2cf78,
      roughness: 0.25,
      metalness: 0.85
    });

    const vuGreen = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const vuYellow = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const vuRed = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    // 1. DÀN THÁP LOA SÂN KHẤU & SUBWOOFER KÉP (2 Massive Cinema Stage Sound Stacks)
    // Đặt 2 bên màn chiếu lớn 13.6m (x = -8.5 và +8.5, z = -8.3)
    for (const side of [-8.5, 8.5]) {
      const towerGroup = new THREE.Group();
      towerGroup.position.set(side, 0.0, -8.3);
      towerGroup.rotation.y = side < 0 ? 0.18 : -0.18;

      // --- Tầng 1: Dual 18" Subwoofer Cabinet (Thùng loa siêu trầm kép) ---
      const subCabGeo = new THREE.BoxGeometry(1.4, 1.8, 1.25);
      const subCab = new THREE.Mesh(subCabGeo, cabinetMat);
      subCab.position.set(0, 0.9, 0);
      towerGroup.add(subCab);

      // Gold perimeter trim for subwoofer
      const subTrimGeo = new THREE.BoxGeometry(1.44, 0.05, 1.29);
      const subTrim = new THREE.Mesh(subTrimGeo, goldTrim);
      subTrim.position.set(0, 1.82, 0);
      towerGroup.add(subTrim);

      // 2 Massive 18" Subwoofer Cones
      for (const subY of [0.55, 1.35]) {
        const ringGeo = new THREE.TorusGeometry(0.38, 0.04, 12, 32);
        const ring = new THREE.Mesh(ringGeo, surroundConeMat);
        ring.position.set(0, subY, 0.64);
        towerGroup.add(ring);

        const coneGeo = new THREE.ConeGeometry(0.36, 0.14, 32, 1, true);
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.rotation.x = Math.PI / 2;
        cone.position.set(0, subY, 0.58);
        towerGroup.add(cone);
        this.subwooferMeshes.push(cone);

        const capGeo = new THREE.SphereGeometry(0.12, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const cap = new THREE.Mesh(capGeo, dustCapMat);
        cap.rotation.x = -Math.PI / 2;
        cap.position.set(0, subY, 0.62);
        towerGroup.add(cap);
      }

      // Bass reflex ports at bottom
      for (const portX of [-0.4, 0.4]) {
        const portGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.15, 16);
        const port = new THREE.Mesh(portGeo, cabinetMat);
        port.rotation.x = Math.PI / 2;
        port.position.set(portX, 0.16, 0.62);
        towerGroup.add(port);
      }

      // --- Tầng 2: Midrange Line Array Cabinet (Thùng loa trung 3-way) ---
      const midCabGeo = new THREE.BoxGeometry(1.3, 1.2, 1.15);
      const midCab = new THREE.Mesh(midCabGeo, cabinetMat);
      midCab.position.set(0, 2.44, 0.02);
      towerGroup.add(midCab);

      // Dual Midrange cones
      for (const midX of [-0.32, 0.32]) {
        const midRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 12, 24), surroundConeMat);
        midRing.position.set(midX, 2.44, 0.61);
        towerGroup.add(midRing);

        const midCap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), dustCapMat);
        midCap.rotation.x = -Math.PI / 2;
        midCap.position.set(midX, 2.44, 0.60);
        towerGroup.add(midCap);
      }

      // --- Tầng 3: High-Frequency Cinema Horn (Họng kèn treble rạp phim) ---
      const hornCabGeo = new THREE.BoxGeometry(1.2, 0.95, 1.1);
      const hornCab = new THREE.Mesh(hornCabGeo, cabinetMat);
      hornCab.position.set(0, 3.52, 0.05);
      towerGroup.add(hornCab);

      const hornFlareGeo = new THREE.BoxGeometry(0.85, 0.44, 0.18);
      const hornFlare = new THREE.Mesh(hornFlareGeo, hornMat);
      hornFlare.position.set(0, 3.52, 0.61);
      towerGroup.add(hornFlare);

      const topTrim = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.04, 1.14), goldTrim);
      topTrim.position.set(0, 4.02, 0.05);
      towerGroup.add(topTrim);

      // --- Biển hiệu phát sáng DOLBY AUDIO rạp phim ---
      const badgeCanvas = document.createElement('canvas');
      badgeCanvas.width = 256;
      badgeCanvas.height = 64;
      const bCtx = badgeCanvas.getContext('2d');
      bCtx.fillStyle = '#0f110f';
      bCtx.fillRect(0, 0, 256, 64);
      bCtx.strokeStyle = '#f2cf78';
      bCtx.lineWidth = 3;
      bCtx.strokeRect(4, 4, 248, 56);
      bCtx.font = 'bold 24px "JetBrains Mono", sans-serif';
      bCtx.fillStyle = '#f2cf78';
      bCtx.textAlign = 'center';
      bCtx.textBaseline = 'middle';
      bCtx.fillText('✦ DOLBY AUDIO ✦', 128, 34);

      const badgeTex = new THREE.CanvasTexture(badgeCanvas);
      const badgeMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 0.24),
        new THREE.MeshBasicMaterial({ map: badgeTex })
      );
      badgeMesh.position.set(0, 1.78, 0.65);
      towerGroup.add(badgeMesh);

      // --- Cột đèn LED hiển thị âm lượng (VU-meter strip) ---
      const meterX = side < 0 ? 0.72 : -0.72;
      for (let m = 0; m < 7; m++) {
        const mat = m < 4 ? vuGreen : (m < 6 ? vuYellow : vuRed);
        const ledGeo = new THREE.BoxGeometry(0.04, 0.08, 0.14);
        const led = new THREE.Mesh(ledGeo, mat);
        led.position.set(meterX, 1.2 + m * 0.14, 0.52);
        towerGroup.add(led);
        this.soundMeterLeds.push({ mesh: led, index: m });
      }

      this.scene.add(towerGroup);
    }

    // 2. DÀN LOA VÒM TREO TƯỜNG (12 Dolby Atmos Cinema Wall Surround Speakers)
    const sideWallZ = [-6.5, -2.5, 1.5, 5.5, 9.5];
    for (const z of sideWallZ) {
      this.createWallSurroundUnit(-hallWidth / 2 + 0.35, 6.4, z, Math.PI / 2, 0.22);
      this.createWallSurroundUnit(hallWidth / 2 - 0.35, 6.4, z, -Math.PI / 2, -0.22);
    }

    // 2 Loa vòm tường sau (Rear Wall Speakers)
    this.createWallSurroundUnit(-4.0, 6.4, 13.15, Math.PI, 0.22);
    this.createWallSurroundUnit(4.0, 6.4, 13.15, Math.PI, 0.22);

    // 3. BIỂN HIỆU DOLBY ATMOS TREO TƯỜNG (Illuminated Wall Plaques)
    for (const side of [-hallWidth / 2 + 0.28, hallWidth / 2 - 0.28]) {
      const plaqueCanvas = document.createElement('canvas');
      plaqueCanvas.width = 512;
      plaqueCanvas.height = 140;
      const pCtx = plaqueCanvas.getContext('2d');
      pCtx.fillStyle = '#101210';
      pCtx.fillRect(0, 0, 512, 140);
      pCtx.strokeStyle = '#06b6d4';
      pCtx.lineWidth = 6;
      pCtx.strokeRect(6, 6, 500, 128);

      pCtx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
      pCtx.fillStyle = '#06b6d4';
      pCtx.textAlign = 'center';
      pCtx.fillText('✦ DOLBY ATMOS ✦', 256, 58);

      pCtx.font = '600 20px "Plus Jakarta Sans", sans-serif';
      pCtx.fillStyle = '#e2e8f0';
      pCtx.textAlign = 'center';
      pCtx.fillText('IMMERSIVE 360° CINEMA AUDIO', 256, 102);

      const plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
      const plaqueMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.44),
        new THREE.MeshBasicMaterial({ map: plaqueTex })
      );
      plaqueMesh.position.set(side, 4.8, 1.8);
      plaqueMesh.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      this.scene.add(plaqueMesh);
    }
  }

  createWallSurroundUnit(x, y, z, rotY, rotZ = 0) {
    const speakerGroup = new THREE.Group();
    speakerGroup.position.set(x, y, z);
    speakerGroup.rotation.y = rotY;
    speakerGroup.rotation.z = rotZ;
    speakerGroup.rotation.x = -0.22; // Vát nghiêng 13 độ xuống khán giả

    // Thùng loa vòm hình nêm vát góc chuẩn rạp
    const cabGeo = new THREE.BoxGeometry(0.62, 0.78, 0.38);
    const cabMat = new THREE.MeshStandardMaterial({ color: 0x141614, roughness: 0.7, metalness: 0.3 });
    const cab = new THREE.Mesh(cabGeo, cabMat);
    speakerGroup.add(cab);

    // Lưới ê-căng tiêu âm mặt trước
    const grilleGeo = new THREE.BoxGeometry(0.58, 0.74, 0.04);
    const grilleMat = new THREE.MeshStandardMaterial({ color: 0x222622, roughness: 0.85 });
    const grille = new THREE.Mesh(grilleGeo, grilleMat);
    grille.position.set(0, 0, 0.2);
    speakerGroup.add(grille);

    // Loa Bass / Mid Cone
    const wooferGeo = new THREE.TorusGeometry(0.18, 0.025, 12, 24);
    const wooferMat = new THREE.MeshStandardMaterial({ color: 0x333833, metalness: 0.5 });
    const woofer = new THREE.Mesh(wooferGeo, wooferMat);
    woofer.position.set(0, -0.12, 0.23);
    speakerGroup.add(woofer);

    const dustCap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd4d8dc, metalness: 0.9 }));
    dustCap.position.set(0, -0.12, 0.24);
    speakerGroup.add(dustCap);

    // Họng kèn Treble Horn
    const hornGeo = new THREE.BoxGeometry(0.28, 0.14, 0.04);
    const horn = new THREE.Mesh(hornGeo, new THREE.MeshStandardMaterial({ color: 0x0a0c0a, roughness: 0.5 }));
    horn.position.set(0, 0.18, 0.23);
    speakerGroup.add(horn);

    // Đèn LED chỉ thị Dolby Atmos màu xanh cyan rực rỡ
    const ledGeo = new THREE.SphereGeometry(0.025, 8, 8);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0, 0.34, 0.23);
    speakerGroup.add(led);

    this.scene.add(speakerGroup);
  }

  buildExitDoors(hallWidth = 21, hallLength = 26, hallHeight = 12.2) {
    this.exitDoorMeshes = [];

    const createDoorUnit = (x, y, z, rotY = 0, name = 'Exit Door') => {
      const doorGroup = new THREE.Group();
      doorGroup.position.set(x, y, z);
      doorGroup.rotation.y = rotY;

      // 1. Frame
      const frameGeo = new THREE.BoxGeometry(2.3, 3.4, 0.16);
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x1f2421,
        roughness: 0.6,
        metalness: 0.4
      });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.set(0, 1.7, 0);
      doorGroup.add(frame);

      // 2. Double Emergency Exit Door Panels
      const doorMat = new THREE.MeshStandardMaterial({
        color: 0x121714,
        roughness: 0.45,
        metalness: 0.25
      });
      for (const side of [-0.55, 0.55]) {
        const panelGeo = new THREE.BoxGeometry(1.02, 3.15, 0.12);
        const panel = new THREE.Mesh(panelGeo, doorMat);
        panel.position.set(side, 1.68, 0.02);
        doorGroup.add(panel);

        // Metallic Panic Push Bar
        const barGeo = new THREE.BoxGeometry(0.88, 0.08, 0.14);
        const barMat = new THREE.MeshStandardMaterial({
          color: 0x10b981,
          roughness: 0.2,
          metalness: 0.85,
          emissive: 0x059669,
          emissiveIntensity: 0.35
        });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.set(side, 1.45, 0.1);
        doorGroup.add(bar);
      }

      // 3. Illuminated Neon Green EXIT Sign Box above door
      const signBoxGeo = new THREE.BoxGeometry(1.4, 0.52, 0.22);
      const signBoxMat = new THREE.MeshStandardMaterial({
        color: 0x064e3b,
        roughness: 0.4,
        metalness: 0.6
      });
      const signBox = new THREE.Mesh(signBoxGeo, signBoxMat);
      signBox.position.set(0, 3.68, 0.08);
      doorGroup.add(signBox);

      // EXIT Canvas Graphic Texture
      const exitCanvas = document.createElement('canvas');
      exitCanvas.width = 256;
      exitCanvas.height = 96;
      const ctx = exitCanvas.getContext('2d');

      // Vivid Green LED backlight box
      ctx.fillStyle = '#059669';
      ctx.fillRect(0, 0, 256, 96);

      // White glowing border
      ctx.strokeStyle = '#a7f3d0';
      ctx.lineWidth = 6;
      ctx.strokeRect(4, 4, 248, 88);

      // Running figure symbol & EXIT
      ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏃 EXIT ➔', 128, 36);

      ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#d1fae5';
      ctx.fillText('LỐI RA', 128, 70);

      const exitTex = new THREE.CanvasTexture(exitCanvas);
      const signFaceGeo = new THREE.PlaneGeometry(1.36, 0.48);
      const signFaceMat = new THREE.MeshBasicMaterial({ map: exitTex });
      const signFace = new THREE.Mesh(signFaceGeo, signFaceMat);
      signFace.position.set(0, 3.68, 0.2);
      doorGroup.add(signFace);

      // Green point light illuminating the exit threshold
      const exitLight = new THREE.PointLight(0x10b981, 1.5, 6.0);
      exitLight.position.set(0, 3.4, 0.5);
      doorGroup.add(exitLight);

      doorGroup.userData = { isExitDoor: true, doorName: name };
      frame.userData = { isExitDoor: true };
      signBox.userData = { isExitDoor: true };
      signFace.userData = { isExitDoor: true };

      this.scene.add(doorGroup);
      this.exitDoorMeshes.push(doorGroup);
    };

    // Exit Door 1: Front right wall beside screen (facing inwards into theater, visible in Overview & Screen view)
    createDoorUnit(hallWidth / 2 - 0.12, 0.0, -4.5, -Math.PI / 2, 'Front Exit Door');

    // Exit Door 2: Rear wall beside seats (facing front, visible in Audience view)
    createDoorUnit(7.5, 1.6, 13.2, Math.PI, 'Rear Exit Door');
  }

  buildScreenAndCSS3D() {
    const screenWidth = 13.6;
    const screenHeight = 7.65;

    // In WebGL, add the outer frame bezel behind the screen
    if (this.hasWebGL) {
      const frameGeo = new THREE.BoxGeometry(screenWidth + 0.7, screenHeight + 0.55, 0.3);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x070807, roughness: 0.7 });
      const screenFrame = new THREE.Mesh(frameGeo, frameMat);
      screenFrame.position.set(0, 5.65, -9.85);
      this.scene.add(screenFrame);

      // Glowing Neon Brand Text beneath screen: "✦ W E T U B E   C I N É   M I N I ✦"
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 1024;
      signCanvas.height = 128;
      const ctx = signCanvas.getContext('2d');
      ctx.fillStyle = '#060706';
      ctx.fillRect(0, 0, signCanvas.width, signCanvas.height);
      ctx.font = 'bold 42px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#f2cf78';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#f2cf78';
      ctx.shadowBlur = 22;
      ctx.fillText('✦ W E T U B E   C I N É   M I N I ✦', 512, 64);

      const signTex = new THREE.CanvasTexture(signCanvas);
      const signGeo = new THREE.PlaneGeometry(5.2, 0.56);
      const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true });
      const signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.set(0, 1.38, -9.45);
      this.scene.add(signMesh);

      // Warm Glow behind the screen
      this.screenBackLight = new THREE.PointLight(0xf2cf78, 1.4, 15);
      this.screenBackLight.position.set(0, 5.65, -9.2);
      this.scene.add(this.screenBackLight);
    }

    // Attach CSS3DObject (YouTube Player DOM element)
    const screenElement = document.getElementById('screen-surface');
    if (screenElement && typeof THREE.CSS3DObject !== 'undefined' && this.cssScene) {
      this.cssScreenObject = new THREE.CSS3DObject(screenElement);
      this.cssScreenObject.position.set(0, 5.65, -9.6);
      const scaleFactor = screenWidth / 1280;
      this.cssScreenObject.scale.set(scaleFactor, scaleFactor, scaleFactor);
      this.cssScene.add(this.cssScreenObject);
    }
  }

  buildSeats() {
    const leatherRed = new THREE.MeshStandardMaterial({
      color: 0x7a1e28, // Luxurious dark red velvet / leather (VIP)
      roughness: 0.65,
      metalness: 0.15
    });

    const leatherSweetbox = new THREE.MeshStandardMaterial({
      color: 0x9d174d, // Romantic deep rose-magenta velvet (Sweetbox Couple)
      roughness: 0.55,
      metalness: 0.2,
      emissive: 0x4a044e,
      emissiveIntensity: 0.15
    });

    const darkArmMat = new THREE.MeshStandardMaterial({
      color: 0x222422,
      roughness: 0.7,
      metalness: 0.3
    });

    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x151615,
      roughness: 0.8,
      metalness: 0.5
    });

    // 1. HÀNG A & HÀNG B (Ghế đơn tiêu chuẩn & VIP nhung đỏ: seatId 0..9)
    for (let i = 0; i < 10; i++) {
      const coord = this.seatCoords[i];
      const seatGroup = new THREE.Group();
      seatGroup.position.set(coord.x, coord.y, coord.z);

      const isVip = i >= 5;
      const seatMat = isVip ? leatherRed : leatherRed;
      const w = 1.2;
      const baseW = 1.3;

      // Base
      const baseGeo = new THREE.BoxGeometry(baseW, 0.2, 1.1);
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.set(0, 0.1, 0);
      seatGroup.add(base);

      // Cushion
      const cushionGeo = new THREE.BoxGeometry(w, 0.35, 1.05);
      const cushion = new THREE.Mesh(cushionGeo, seatMat);
      cushion.position.set(0, 0.35, -0.05);
      seatGroup.add(cushion);

      // Backrest
      const backGeo = new THREE.BoxGeometry(w, 1.25, 0.28);
      const backrest = new THREE.Mesh(backGeo, seatMat);
      backrest.position.set(0, 1.05, 0.44);
      backrest.rotation.x = -0.12;
      seatGroup.add(backrest);

      // Headrest
      const headGeo = new THREE.BoxGeometry(0.85, 0.32, 0.18);
      const headrest = new THREE.Mesh(headGeo, seatMat);
      headrest.position.set(0, 1.62, 0.48);
      seatGroup.add(headrest);

      // Armrests & Cup holders
      for (const side of [-0.68, 0.68]) {
        const armGeo = new THREE.BoxGeometry(0.22, 0.6, 1.05);
        const arm = new THREE.Mesh(armGeo, darkArmMat);
        arm.position.set(side, 0.6, 0);
        seatGroup.add(arm);

        const cupGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12);
        const cup = new THREE.Mesh(cupGeo, baseMat);
        cup.position.set(side, 0.91, -0.35);
        seatGroup.add(cup);
      }

      // Seat Plate
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 160;
      labelCanvas.height = 64;
      const lCtx = labelCanvas.getContext('2d');
      lCtx.fillStyle = '#222522';
      lCtx.fillRect(0, 0, 160, 64);
      lCtx.strokeStyle = isVip ? '#fbbf24' : '#f2cf78';
      lCtx.lineWidth = 4;
      lCtx.strokeRect(2, 2, 156, 60);
      lCtx.font = 'bold 34px "JetBrains Mono", monospace';
      lCtx.fillStyle = isVip ? '#fbbf24' : '#f2cf78';
      lCtx.textAlign = 'center';
      lCtx.textBaseline = 'middle';
      lCtx.fillText(coord.label, 80, 34);

      const labelTex = new THREE.CanvasTexture(labelCanvas);
      const labelGeo = new THREE.PlaneGeometry(0.38, 0.18);
      const labelMat = new THREE.MeshBasicMaterial({ map: labelTex });
      const labelMesh = new THREE.Mesh(labelGeo, labelMat);
      labelMesh.position.set(0, 1.48, 0.59);
      seatGroup.add(labelMesh);

      seatGroup.userData = { seatId: coord.id, label: coord.label, coord, isCouple: false };
      seatGroup.traverse((child) => {
        if (child.isMesh) {
          child.userData = { seatId: coord.id, parentGroup: seatGroup, isCouple: false };
        }
      });

      this.scene.add(seatGroup);
      this.seatMeshes[coord.id] = seatGroup;
      this.avatarMeshes[coord.id] = null;
    }

    // 2. HÀNG C: 3 GHẾ ĐÔI SWEETBOX (Mỗi ghế ngồi được 2 người = 6 chỗ: C01..C06)
    const coupleSofas = [
      { group: 1, leftId: 10, rightId: 11, sofaX: -4.5 },
      { group: 2, leftId: 12, rightId: 13, sofaX: 0.0 },
      { group: 3, leftId: 14, rightId: 15, sofaX: 4.5 }
    ];

    coupleSofas.forEach((sofa) => {
      const sofaGroup = new THREE.Group();
      sofaGroup.position.set(sofa.sofaX, 1.65, 3.6);

      const leftCoord = this.seatCoords[sofa.leftId];
      const rightCoord = this.seatCoords[sofa.rightId];

      // Base
      const baseGeo = new THREE.BoxGeometry(2.45, 0.2, 1.1);
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.set(0, 0.1, 0);
      sofaGroup.add(base);

      // Left & Right Cushions (2 chỗ ngồi riêng biệt trên cùng chiếc sofa đôi)
      const cushGeo = new THREE.BoxGeometry(1.12, 0.35, 1.05);
      const cushLeft = new THREE.Mesh(cushGeo, leatherSweetbox);
      cushLeft.position.set(-0.58, 0.35, -0.05);
      cushLeft.userData = { seatId: sofa.leftId, label: leftCoord.label, isCouple: true, coupleSide: 'Trái' };
      sofaGroup.add(cushLeft);

      const cushRight = new THREE.Mesh(cushGeo, leatherSweetbox);
      cushRight.position.set(0.58, 0.35, -0.05);
      cushRight.userData = { seatId: sofa.rightId, label: rightCoord.label, isCouple: true, coupleSide: 'Phải' };
      sofaGroup.add(cushRight);

      // Left & Right Backrests
      const backGeo = new THREE.BoxGeometry(1.12, 1.25, 0.28);
      const backLeft = new THREE.Mesh(backGeo, leatherSweetbox);
      backLeft.position.set(-0.58, 1.05, 0.44);
      backLeft.rotation.x = -0.12;
      backLeft.userData = { seatId: sofa.leftId, label: leftCoord.label, isCouple: true };
      sofaGroup.add(backLeft);

      const backRight = new THREE.Mesh(backGeo, leatherSweetbox);
      backRight.position.set(0.58, 1.05, 0.44);
      backRight.rotation.x = -0.12;
      backRight.userData = { seatId: sofa.rightId, label: rightCoord.label, isCouple: true };
      sofaGroup.add(backRight);

      // Dual Headrests (Left & Right)
      const headGeo = new THREE.BoxGeometry(0.85, 0.32, 0.18);
      const headLeft = new THREE.Mesh(headGeo, leatherSweetbox);
      headLeft.position.set(-0.55, 1.62, 0.48);
      headLeft.userData = { seatId: sofa.leftId, label: leftCoord.label };
      sofaGroup.add(headLeft);

      const headRight = new THREE.Mesh(headGeo, leatherSweetbox);
      headRight.position.set(0.55, 1.62, 0.48);
      headRight.userData = { seatId: sofa.rightId, label: rightCoord.label };
      sofaGroup.add(headRight);

      // Sweetbox Curved Privacy Wings on left & right
      const wingGeo = new THREE.BoxGeometry(0.14, 1.42, 1.22);
      const wingLeft = new THREE.Mesh(wingGeo, leatherSweetbox);
      wingLeft.position.set(-1.22, 1.05, 0.1);
      wingLeft.userData = { seatId: sofa.leftId };
      sofaGroup.add(wingLeft);

      const wingRight = new THREE.Mesh(wingGeo, leatherSweetbox);
      wingRight.position.set(1.22, 1.05, 0.1);
      wingRight.userData = { seatId: sofa.rightId };
      sofaGroup.add(wingRight);

      // Armrests & Cup holders
      for (const side of [-1.15, 1.15]) {
        const armGeo = new THREE.BoxGeometry(0.22, 0.6, 1.05);
        const arm = new THREE.Mesh(armGeo, darkArmMat);
        arm.position.set(side, 0.6, 0);
        sofaGroup.add(arm);

        const cupGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12);
        const cup = new THREE.Mesh(cupGeo, baseMat);
        cup.position.set(side, 0.91, -0.35);
        sofaGroup.add(cup);
      }

      // Center Divider Arm & Double Cup Holder (Vách tay vịn giữa 2 bạn)
      const centerArmGeo = new THREE.BoxGeometry(0.18, 0.45, 0.85);
      const centerArm = new THREE.Mesh(centerArmGeo, darkArmMat);
      centerArm.position.set(0, 0.52, -0.05);
      sofaGroup.add(centerArm);

      // Two Separate Seat Label Plates ("C01 💖" and "C02 💖")
      const makePlate = (lbl, sideX, sId) => {
        const pCanvas = document.createElement('canvas');
        pCanvas.width = 160;
        pCanvas.height = 64;
        const ctx = pCanvas.getContext('2d');
        ctx.fillStyle = '#222522';
        ctx.fillRect(0, 0, 160, 64);
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 156, 60);
        ctx.font = 'bold 28px "JetBrains Mono", monospace';
        ctx.fillStyle = '#fb7185';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${lbl} 💖`, 80, 34);

        const pTex = new THREE.CanvasTexture(pCanvas);
        const pMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(0.46, 0.18),
          new THREE.MeshBasicMaterial({ map: pTex })
        );
        pMesh.position.set(sideX, 1.48, 0.59);
        pMesh.userData = { seatId: sId, label: lbl, isCouple: true };
        sofaGroup.add(pMesh);
      };

      makePlate(leftCoord.label, -0.55, sofa.leftId);
      makePlate(rightCoord.label, 0.55, sofa.rightId);

      // Top Header Ribbon: "💖 GHẾ ĐÔI X (SWEETBOX) 💖"
      const topCanvas = document.createElement('canvas');
      topCanvas.width = 384;
      topCanvas.height = 64;
      const tCtx = topCanvas.getContext('2d');
      tCtx.fillStyle = '#1c1518';
      tCtx.fillRect(0, 0, 384, 64);
      tCtx.strokeStyle = '#f43f5e';
      tCtx.lineWidth = 3;
      tCtx.strokeRect(3, 3, 378, 58);
      tCtx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
      tCtx.fillStyle = '#fda4af';
      tCtx.textAlign = 'center';
      tCtx.textBaseline = 'middle';
      tCtx.fillText(`💖 GHẾ ĐÔI ${sofa.group} (2 NGƯỜI) 💖`, 192, 34);

      const topTex = new THREE.CanvasTexture(topCanvas);
      const topMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 0.22),
        new THREE.MeshBasicMaterial({ map: topTex })
      );
      topMesh.position.set(0, 1.84, 0.58);
      sofaGroup.add(topMesh);

      this.couplePlaques[sofa.group] = { canvas: topCanvas, ctx: tCtx, tex: topTex, group: sofa.group };

      // Two Interactive Click Hitboxes (Left & Right halves)
      const hitGeo = new THREE.BoxGeometry(1.18, 1.8, 1.25);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });

      const hitLeft = new THREE.Mesh(hitGeo, hitMat);
      hitLeft.position.set(-0.58, 0.9, 0.0);
      hitLeft.userData = { seatId: sofa.leftId, label: leftCoord.label, isCouple: true, coupleSide: 'Trái' };
      sofaGroup.add(hitLeft);

      const hitRight = new THREE.Mesh(hitGeo, hitMat);
      hitRight.position.set(0.58, 0.9, 0.0);
      hitRight.userData = { seatId: sofa.rightId, label: rightCoord.label, isCouple: true, coupleSide: 'Phải' };
      sofaGroup.add(hitRight);

      this.scene.add(sofaGroup);

      this.seatMeshes[sofa.leftId] = hitLeft;
      this.seatMeshes[sofa.rightId] = hitRight;
      this.avatarMeshes[sofa.leftId] = null;
      this.avatarMeshes[sofa.rightId] = null;
    });
  }

  // Cập nhật tên khắc kỷ niệm trên biển hiệu Ghế Đôi Sweetbox
  updateCoupleSofaName(coupleGroup, customName) {
    const pl = this.couplePlaques[coupleGroup];
    if (!pl) return;
    const { canvas, ctx, tex } = pl;
    ctx.fillStyle = '#1c1518';
    ctx.fillRect(0, 0, 384, 64);
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, 378, 58);
    ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#fda4af';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`💖 ${customName} 💖`, 192, 34);
    tex.needsUpdate = true;
  }

  // Hoạt họa 3D tương tác cặp đôi (Đút bắp ăn chung & Tựa vai xem phim)
  triggerCoupleAction(coupleGroup, action, fromSeatId, toSeatId) {
    if (!this.hasWebGL) return;
    const avFrom = this.avatarMeshes[fromSeatId];
    const avTo = this.avatarMeshes[toSeatId];
    const isFromLeft = (fromSeatId % 2 === 0);

    if (action === 'feed_popcorn') {
      // 1. Nghiêng nhẹ nhân vật về phía người kia đút bắp
      if (avFrom) avFrom.rotation.z = isFromLeft ? -0.22 : 0.22;
      if (avTo) avTo.rotation.z = isFromLeft ? 0.22 : -0.22;

      // 2. Thả hiệu ứng bắp & tim bay lên
      this.spawnEmojiReaction('🍿', fromSeatId, false, true);
      setTimeout(() => this.spawnEmojiReaction('💖', toSeatId, false, true), 300);
      setTimeout(() => this.spawnEmojiReaction('✨', fromSeatId, false, true), 600);

      // 3. Phục hồi tư thế sau 3.5s
      const timerKey = `feed_${coupleGroup}`;
      clearTimeout(this.coupleActionTimeouts[timerKey]);
      this.coupleActionTimeouts[timerKey] = setTimeout(() => {
        if (avFrom) avFrom.rotation.z = 0;
        if (avTo) avTo.rotation.z = 0;
      }, 3500);
    } else if (action === 'lean_shoulder') {
      // 1. Nghiêng người và tựa sát vào vai người bạn bên cạnh
      if (avFrom) {
        avFrom.rotation.z = isFromLeft ? -0.32 : 0.32;
        avFrom.position.x += (isFromLeft ? 0.22 : -0.22);
      }
      if (avTo) {
        avTo.rotation.z = isFromLeft ? 0.12 : -0.12;
      }

      // 2. Thả hiệu ứng tim & giấc mơ ngọt ngào
      this.spawnEmojiReaction('🥰', fromSeatId, false, true);
      setTimeout(() => this.spawnEmojiReaction('💕', toSeatId, false, true), 400);

      // 3. Phục hồi tư thế sau 5.5s
      const timerKey = `lean_${coupleGroup}`;
      clearTimeout(this.coupleActionTimeouts[timerKey]);
      this.coupleActionTimeouts[timerKey] = setTimeout(() => {
        if (avFrom && this.seatCoords[fromSeatId]) {
          avFrom.rotation.z = 0;
          avFrom.position.x = this.seatCoords[fromSeatId].x;
        }
        if (avTo) avTo.rotation.z = 0;
      }, 5500);
    }
  }

  buildDiscoBallAndLights() {
    this.discoBallGroup = new THREE.Group();
    this.discoBallGroup.position.set(0, 10.8, -3.0);

    const rodGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.2 });
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.position.set(0, 0.6, 0);
    this.discoBallGroup.add(rod);

    const sphereGeo = new THREE.IcosahedronGeometry(0.45, 3);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      metalness: 0.95,
      roughness: 0.1,
      flatShading: true
    });
    const ball = new THREE.Mesh(sphereGeo, sphereMat);
    this.discoBallGroup.add(ball);
    this.scene.add(this.discoBallGroup);

    // 4 Spotlights
    const spotColors = [0xec4899, 0x3b82f6, 0xf59e0b, 0x10b981];
    const spotOffsets = [
      { x: -5, z: -4 },
      { x: 5, z: -4 },
      { x: -5, z: 4 },
      { x: 5, z: 4 }
    ];

    spotColors.forEach((color, i) => {
      const spot = new THREE.SpotLight(color, 0, 18, Math.PI / 6, 0.4, 1.2);
      spot.position.set(spotOffsets[i].x, 9.5, spotOffsets[i].z);
      spot.target = ball;
      this.scene.add(spot);
      this.spotlights.push(spot);
    });

    // Lasers
    const laserColors = [0xef4444, 0x10b981, 0x8b5cf6, 0x06b6d4];
    for (let i = 0; i < 4; i++) {
      const laserGeo = new THREE.CylinderGeometry(0.02, 0.02, 22, 6);
      const laserMat = new THREE.MeshBasicMaterial({
        color: laserColors[i],
        transparent: true,
        opacity: 0
      });
      const laser = new THREE.Mesh(laserGeo, laserMat);
      laser.position.set((i - 1.5) * 3, 8.5, 0);
      laser.rotation.x = Math.PI / 2.3;
      this.scene.add(laser);
      this.laserBeams.push(laser);
    }
  }

  setPartyMode(active) {
    this.partyMode = !!active;
    this.applyLightingState();
  }

  setLightsOff(active) {
    this.lightsOff = !!active;
    document.body.classList.toggle('lights-off', this.lightsOff);
    this.applyLightingState();
  }

  applyLightingState() {
    if (!this.hasWebGL) return;

    // 1. Base theater room lighting (controlled by lightsOff)
    if (this.lightsOff) {
      if (this.ambientLight) this.ambientLight.intensity = this.partyMode ? 0.12 : 0.05;
      if (this.warmKeyLight) this.warmKeyLight.intensity = 0.04;
      if (this.wallMat) this.wallMat.color.setHex(0x040504);
      if (this.floorMat) this.floorMat.color.setHex(0x060706);
      if (this.screenBackLight) this.screenBackLight.intensity = 0.55;
    } else {
      if (this.ambientLight) this.ambientLight.intensity = 0.46;
      if (this.warmKeyLight) this.warmKeyLight.intensity = 0.65;
      if (this.wallMat) this.wallMat.color.setHex(0x111311);
      if (this.floorMat) this.floorMat.color.setHex(0x161816);
      if (this.screenBackLight) this.screenBackLight.intensity = 1.4;
    }

    // 2. Party disco spotlights, lasers & neon wall strips (works both when lights are ON or OFF!)
    const spotIntensity = this.partyMode ? (this.lightsOff ? 6.5 : 4.8) : 0;
    this.spotlights.forEach((spot) => {
      spot.intensity = spotIntensity;
    });

    this.laserBeams.forEach((laser) => {
      laser.material.opacity = this.partyMode ? (this.lightsOff ? 0.85 : 0.65) : 0;
    });

    if (!this.partyMode) {
      if (this.lightsOff) {
        if (this.goldTrimMat) {
          this.goldTrimMat.color.setHex(0x14120c);
          this.goldTrimMat.emissive.setHex(0x000000);
          this.goldTrimMat.emissiveIntensity = 0.0;
        }
        if (this.stepStripMat) this.stepStripMat.color.setHex(0x2e1f05);
        if (this.stageEdgeMat) this.stageEdgeMat.color.setHex(0x2e2512);
      } else {
        if (this.goldTrimMat) {
          this.goldTrimMat.color.setHex(0xf2cf78);
          this.goldTrimMat.emissive.setHex(0x705218);
          this.goldTrimMat.emissiveIntensity = 0.22;
        }
        if (this.stepStripMat) this.stepStripMat.color.setHex(0xf59e0b);
        if (this.stageEdgeMat) this.stageEdgeMat.color.setHex(0xf2cf78);
      }
    }
  }

  // Update All 13 Seats for Real Users (Row A: 5, Row B: 5, Row C Sweetbox: 3)
  updateSeats(seatsData) {
    if (!seatsData || !this.hasWebGL) return;

    const total = Math.max(this.seatCoords.length, seatsData.length);
    for (let i = 0; i < total; i++) {
      const occupant = seatsData[i];
      if (occupant) {
        const prevData = this.avatarMeshes[i]?.userData;
        const hasChanged = !prevData
          || prevData.userId !== occupant.userId
          || prevData.avatarId !== occupant.avatarId
          || prevData.name !== occupant.name
          || prevData.tier !== occupant.tier
          || !!prevData.micOn !== !!occupant.micOn;
        if (hasChanged) {
          this.removeAvatarFromSeat(i);
          this.createAvatarAtSeat(i, occupant);
        }
      } else {
        this.removeAvatarFromSeat(i);
      }
    }
  }

  createPixelCharacterSprite(avatarId = 'pixel_nerd', scaleY = 1.45) {
    if (window.PixelAvatars) {
      const canvas = window.PixelAvatars.createSpriteCanvas(avatarId);
      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(scaleY * (24 / 30), scaleY, 1);
      return sprite;
    }
    return new THREE.Group();
  }

  createAvatarAtSeat(seatId, user) {
    const coord = this.seatCoords[seatId];
    if (!coord) return;

    const avatarGroup = new THREE.Group();
    avatarGroup.position.set(coord.x, coord.y + 0.35, coord.z + 0.08);
    avatarGroup.userData = {
      userId: user.userId || user.id,
      avatarId: user.avatarId || 'pixel_nerd',
      name: user.name,
      tier: user.tier,
      micOn: !!user.micOn
    };

    // Chibi 16-bit Pixel Art Character Sprite (seated naturally in chair)
    const charSprite = this.createPixelCharacterSprite(user.avatarId || 'pixel_nerd', 1.42);
    charSprite.position.set(0, 0.72, 0);
    avatarGroup.add(charSprite);

    // Name Tag (positioned above head)
    const displayLabel = user.micOn ? `🎙️ ${user.name}` : user.name;
    const tagColor = user.micOn ? '#10b981' : (user.color || '#f2cf78');
    const nameSprite = this.createNameTagSprite(displayLabel, user.tier, tagColor);
    nameSprite.position.set(0, 1.68, 0);
    avatarGroup.add(nameSprite);

    this.scene.add(avatarGroup);
    this.avatarMeshes[seatId] = avatarGroup;
  }

  removeAvatarFromSeat(seatId) {
    if (this.avatarMeshes[seatId]) {
      this.scene.remove(this.avatarMeshes[seatId]);
      this.avatarMeshes[seatId] = null;
    }
  }

  updateStageUser() {
    if (this.stageAvatar) {
      this.scene.remove(this.stageAvatar);
      this.stageAvatar = null;
    }
  }

  createNameTagSprite(name, tier = 'Khán Giả', color = '#f2cf78') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 140;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(18, 20, 18, 0.88)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    this.roundRect(ctx, 10, 10, 492, 120, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name.substring(0, 18), 256, 60);

    ctx.fillStyle = color;
    ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`✦ ${tier || 'Khán Giả VIP'} ✦`, 256, 104);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.45, 0.39, 1);
    return sprite;
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  showSpeechBubble(userId, text, seatId, isOnStage) {
    if (!this.hasWebGL) return;
    let targetPos = null;
    if (isOnStage && this.stageAvatar) {
      targetPos = this.stageAvatar.position.clone().add(new THREE.Vector3(0, 2.2, 0));
    } else if (seatId !== null && this.avatarMeshes[seatId]) {
      targetPos = this.avatarMeshes[seatId].position.clone().add(new THREE.Vector3(0, 1.9, 0));
    }

    if (!targetPos) return;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    this.roundRect(ctx, 10, 10, 492, 120, 20);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(240, 130);
    ctx.lineTo(256, 155);
    ctx.lineTo(272, 130);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 32px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.substring(0, 26), 256, 70);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(targetPos);
    sprite.scale.set(2.4, 0.75, 1);

    this.scene.add(sprite);

    setTimeout(() => {
      this.scene.remove(sprite);
      texture.dispose();
      spriteMat.dispose();
    }, 5000);
  }

  spawnEmojiReaction(emoji, seatId, isOnStage, isVip = false) {
    // 1. DOM floating animation overlay (luôn hiển thị rõ nét trên màn hình)
    this.spawnDomFloatingEmoji(emoji, isVip);

    // 2. 3D WebGL floating sprite (nếu có WebGL)
    if (!this.hasWebGL) return;
    let startPos = new THREE.Vector3(0, 1.8, -6.6);
    if (seatId !== null && this.seatCoords[seatId]) {
      const c = this.seatCoords[seatId];
      startPos.set(c.x + (Math.random() - 0.5) * 0.4, c.y + 1.2, c.z);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = isVip ? 'bold 68px sans-serif' : '72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isVip) {
      ctx.shadowColor = 'rgba(245, 158, 11, 0.9)';
      ctx.shadowBlur = 16;
    }
    ctx.fillText(emoji, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(startPos);
    const scale = isVip ? 1.35 : 0.9;
    sprite.scale.set(scale, scale, 1);

    this.scene.add(sprite);

    this.floatingParticles.push({
      sprite,
      vy: 1.8 + Math.random() * 0.8,
      vx: (Math.random() - 0.5) * 0.6,
      opacity: 1.0
    });
  }

  spawnDomFloatingEmoji(emoji, isVip = false) {
    const el = document.createElement('div');
    el.className = 'dom-floating-emoji' + (isVip ? ' vip-emoji' : '');
    el.textContent = isVip ? `✨${emoji}` : emoji;
    const rightDock = 15 + Math.random() * 65;
    const bottomDock = 60 + Math.random() * 80;
    const size = isVip ? (36 + Math.floor(Math.random() * 14)) : (26 + Math.floor(Math.random() * 16));
    el.style.fontSize = `${size}px`;
    el.style.right = `${rightDock}px`;
    el.style.bottom = `${bottomDock}px`;
    document.body.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 2200);
  }

  setDataSaver(enabled) {
    this.isDataSaver = !!enabled;
    if (this.renderer) {
      this.renderer.setPixelRatio(enabled ? 1.0 : Math.min(window.devicePixelRatio, 2));
    }
  }

  getScreenCameraPosition() {
    const width = this.container ? (this.container.clientWidth || window.innerWidth) : window.innerWidth;
    const height = this.container ? (this.container.clientHeight || window.innerHeight) : window.innerHeight;
    const aspect = width / (height || 1);

    // Thu nhỏ lại một tí theo yêu cầu người dùng để màn chiếu không bao giờ bị cắt viền (cut off)
    // Tỷ lệ chiếm khung hình chuẩn: ~87% (vừa vặn, full màn hình thoáng đãng, thấy trọn 100% 4 góc)
    const safeFill = 0.87;
    const fovRad = THREE.MathUtils.degToRad((this.camera ? this.camera.fov : 54) / 2);
    const fovTan = Math.tan(fovRad);
    const screenWidth = 13.6;
    const screenHeight = 7.65;
    const dHeight = (screenHeight / safeFill) / (2 * fovTan);
    const dWidth = (screenWidth / safeFill) / (2 * fovTan * Math.max(0.55, aspect));
    const dist = Math.max(dHeight, dWidth);
    return new THREE.Vector3(0, 5.65, -9.6 + dist);
  }

  setCameraMode(mode, seatId = null) {
    if (this.cameraMode === mode) return;
    const prevMode = this.cameraMode;
    this.cameraMode = mode;
    this.mouseOffsetX = 0;
    this.mouseOffsetY = 0;
    this.targetMouseX = 0;
    this.targetMouseY = 0;
    this.markActive();

    let targetPos, targetLook;
    switch (mode) {
      case 'overview':
        targetPos = new THREE.Vector3(0, 9.4, 12.2);
        targetLook = new THREE.Vector3(0, 4.8, -2.2);
        break;

      case 'screen':
        // Chế độ Màn hình: Tự động tính khoảng cách lùi camera theo tỷ lệ màn hình thực tế (Aspect Ratio)
        // Đảm bảo toàn bộ khung hình 16:9 lọt trọn vẹn 100% trong tầm nhìn, không bị cắt viền (cut off) ở bất kỳ màn hình nào
        targetPos = this.getScreenCameraPosition();
        targetLook = new THREE.Vector3(0, 5.65, -9.6);
        break;

      case 'audience':
        targetPos = new THREE.Vector3(0, 2.2, -6.8);
        targetLook = new THREE.Vector3(0, 2.1, 1.5);
        break;

      default:
        targetPos = new THREE.Vector3(0, 9.4, 12.2);
        targetLook = new THREE.Vector3(0, 4.8, -2.2);
    }

    this.camTargetPos.copy(targetPos);
    this.camTargetLook.copy(targetLook);

    const isDirectionFlip = (prevMode === 'audience' || mode === 'audience');
    const vp = document.getElementById('cinema-viewport');

    if (isDirectionFlip) {
      // Khi quay giữa Khán giả <-> Màn hình / Toàn cảnh (quay ngược 180 độ):
      // Dùng hiệu ứng chuyển cảnh mềm êm dịu (Soft dissolve cut 140ms):
      this.isFlipping = true;
      this.dollyActive = false;
      if (vp) vp.classList.add('cam-switching');

      setTimeout(() => {
        this.camera.position.copy(targetPos);
        this.camCurrentLook.copy(targetLook);
        this.camera.lookAt(this.camCurrentLook);
        setTimeout(() => {
          if (vp) vp.classList.remove('cam-switching');
          this.isFlipping = false;
        }, 40);
      }, 110);
    } else {
      // Chuyển giữa Toàn cảnh <-> Màn hình: Lướt Cinematic mượt mà (Ease-in-out 720ms), êm ái tự nhiên, không khựng cứng
      this.isFlipping = false;
      this.dollyActive = true;
      this.dollyStart = performance.now();
      this.dollyDuration = 720;
      this.dollyFromPos = this.camera.position.clone();
      this.dollyFromLook = this.camCurrentLook.clone();
    }
  }

  markActive() {
    this.lastActiveTime = performance.now();
  }

  pause() {
    this.isPaused = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.clock.start();
    this.animate();
  }

  setQuality(quality) {
    this.quality = quality;
    if (this.hasWebGL && this.renderer) {
      if (quality === 'low') {
        this.renderer.setPixelRatio(1.0);
        this.renderer.shadowMap.enabled = false;
      } else if (quality === 'medium') {
        this.renderer.setPixelRatio(1.25);
        this.renderer.shadowMap.enabled = false;
      } else { // 'high'
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
        this.renderer.shadowMap.enabled = true;
      }
    }
  }

  triggerGiftCelebrationLighting(cost = 100) {
    if (!this.hasWebGL || !this.spotlights) return;
    const origSpeeds = this.spotlights.map(s => s.userData?.speed || 1);
    this.spotlights.forEach(s => {
      if (s.userData) s.userData.speed = 3.5;
    });

    const origAmbient = this.ambientLight ? this.ambientLight.intensity : 0.46;
    let flashCount = 0;
    const flashInterval = setInterval(() => {
      if (this.ambientLight) {
        this.ambientLight.intensity = (flashCount % 2 === 0) ? 0.85 : 0.35;
      }
      flashCount++;
      if (flashCount > 10) {
        clearInterval(flashInterval);
        if (this.ambientLight) this.ambientLight.intensity = origAmbient;
        this.spotlights.forEach((s, idx) => {
          if (s.userData) s.userData.speed = origSpeeds[idx] || 1;
        });
      }
    }, 280);
  }

  onPointerDown(e) {
    this.isDragging = true;
    this.lastMousePos = { x: e.clientX, y: e.clientY };
    this.markActive();
  }

  onPointerMove(e) {
    if (!this.hasWebGL || this.isPaused) return;
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.checkSeatHover();

    if (this.isDragging && (this.cameraMode === 'overview' || this.cameraMode === 'audience')) {
      const dx = e.clientX - this.lastMousePos.x;
      const dy = e.clientY - this.lastMousePos.y;
      this.targetMouseX += dx * 0.003;
      this.targetMouseY += dy * 0.003;
      this.targetMouseY = Math.max(-0.4, Math.min(0.4, this.targetMouseY));
      this.lastMousePos = { x: e.clientX, y: e.clientY };
      this.markActive();
    }
  }

  onPointerUp() {
    this.isDragging = false;
    this.markActive();
  }

  checkSeatHover() {
    if (!this.hasWebGL || this.isPaused) return;

    // Throttle seat hover checks to max 13fps (~75ms)
    const now = performance.now();
    if (now - this.lastHoverCheck < 75) return;
    this.lastHoverCheck = now;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const targets = [...this.seatMeshes.filter(Boolean), ...(this.exitDoorMeshes || [])];
    const intersects = this.raycaster.intersectObjects(targets, true);

    let foundSeat = null;
    let foundExit = false;
    for (const hit of intersects) {
      let obj = hit.object;
      while (obj && obj.userData?.seatId === undefined && !obj.userData?.isExitDoor && obj.parent) {
        obj = obj.parent;
      }
      if (obj && obj.userData?.isExitDoor) {
        foundExit = true;
        break;
      }
      if (obj && obj.userData?.seatId !== undefined) {
        foundSeat = obj.userData.seatId;
        break;
      }
    }

    if (foundExit) {
      this.container.style.cursor = 'pointer';
      this.container.title = '🚪 Cửa Thoát Hiểm (Bấm để rời phòng về Sảnh Chờ)';
    } else {
      if (foundSeat !== this.hoveredSeat) {
        this.hoveredSeat = foundSeat;
        this.container.style.cursor = foundSeat !== null ? 'pointer' : (this.isDragging ? 'grabbing' : 'grab');
        if (foundSeat !== null) {
          const sc = this.seatCoords[foundSeat];
          if (sc && sc.isCouple) {
            this.container.title = `💖 Bấm để chọn ghế đôi ${sc.label} (${sc.coupleSide || ''} - Ghế Đôi ${sc.coupleGroup || 1})`;
          } else {
            this.container.title = `Bấm để chọn ghế ${sc?.label || ''}`;
          }
        } else {
          this.container.title = '';
        }
      }
    }
  }

  onClick(e) {
    if (!this.hasWebGL || this.isPaused) return;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const targets = [...this.seatMeshes.filter(Boolean), ...(this.exitDoorMeshes || [])];
    const intersects = this.raycaster.intersectObjects(targets, true);

    for (const hit of intersects) {
      let obj = hit.object;
      while (obj && obj.userData?.seatId === undefined && !obj.userData?.isExitDoor && obj.parent) {
        obj = obj.parent;
      }
      if (obj && obj.userData?.isExitDoor) {
        if (typeof this.onExitDoorClick === 'function') {
          this.onExitDoorClick();
        }
        break;
      }
      if (obj && obj.userData?.seatId !== undefined) {
        if (typeof this.onSeatClick === 'function') {
          this.onSeatClick(obj.userData.seatId);
        }
        break;
      }
    }
  }

  onWindowResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }

    if (this.hasWebGL && this.renderer) {
      this.renderer.setSize(width, height);
    }
    if (this.cssRenderer) {
      this.cssRenderer.setSize(width, height);
    }
  }

  animate() {
    if (this.isPaused) return;
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const targetPos = this.camTargetPos.clone();
    targetPos.x += Math.sin(this.mouseOffsetX) * 3;
    targetPos.y += this.mouseOffsetY * 2;

    // Check if camera is actively moving or interpolating
    const isCameraMoving = this.dollyActive ||
                           this.isFlipping ||
                           this.isDragging ||
                           Math.abs(this.mouseOffsetX - this.targetMouseX) > 0.002;

    // Check if scene has active dynamic animations (Party mode or floating emoji particles)
    const isDynamic = this.partyMode || this.floatingParticles.length > 0 || (now - this.lastActiveTime < 1800);

    // Adaptive target FPS: 60 FPS when active/moving, throttled to 24 FPS when idle watching movie
    const targetFps = (isCameraMoving || isDynamic) ? 60 : 24;
    const interval = 1000 / targetFps;

    if (now - this.lastRenderTime < interval - 2) {
      return;
    }
    this.lastRenderTime = now;

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.getElapsedTime();

    // Camera Interpolation: mượt mà, dứt khoát, không bồng bềnh hay chóng mặt
    this.mouseOffsetX += (this.targetMouseX - this.mouseOffsetX) * 0.1;
    this.mouseOffsetY += (this.targetMouseY - this.mouseOffsetY) * 0.1;

    if (this.dollyActive) {
      const t = Math.min(1, Math.max(0, (now - this.dollyStart) / this.dollyDuration));
      // Ease-in-out cubic: gia tốc êm ái, chuyển động điện ảnh mượt mà, hạ cánh nhẹ nhàng không khựng
      const ease = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.camera.position.lerpVectors(this.dollyFromPos, targetPos, ease);
      this.camCurrentLook.lerpVectors(this.dollyFromLook, this.camTargetLook, ease);
      this.camera.lookAt(this.camCurrentLook);

      if (t >= 1) {
        this.camera.position.copy(targetPos);
        this.camCurrentLook.copy(this.camTargetLook);
        this.camera.lookAt(this.camCurrentLook);
        this.dollyActive = false;
      }
    } else if (this.isFlipping) {
      this.camera.position.copy(targetPos);
      this.camCurrentLook.copy(this.camTargetLook);
      this.camera.lookAt(this.camCurrentLook);
    } else {
      if (this.isDragging) {
        this.camera.position.lerp(targetPos, 0.15);
        this.camCurrentLook.lerp(this.camTargetLook, 0.15);
      } else {
        this.camera.position.copy(targetPos);
        this.camCurrentLook.copy(this.camTargetLook);
      }
      this.camera.lookAt(this.camCurrentLook);
    }

    // Disco Ball Rotation & Spotlights
    if (this.discoBallGroup) {
      this.discoBallGroup.rotation.y += this.partyMode ? 0.03 : 0.005;
    }

    if (this.partyMode) {
      this.spotlights.forEach((spot, i) => {
        const angle = time * 1.5 + (i * Math.PI) / 2;
        spot.position.x = Math.sin(angle) * 7;
        spot.position.z = Math.cos(angle) * 6;
      });

      this.laserBeams.forEach((laser, i) => {
        laser.rotation.z = Math.sin(time * 2 + i) * 0.25;
      });

      const hue = (time * 0.25) % 1;
      if (this.goldTrimMat) {
        this.goldTrimMat.color.setHSL(hue, 0.85, 0.55);
        this.goldTrimMat.emissive.setHSL(hue, 0.9, 0.4);
        this.goldTrimMat.emissiveIntensity = 0.65;
      }
      if (this.stepStripMat) {
        this.stepStripMat.color.setHSL((hue + 0.33) % 1, 0.9, 0.55);
      }
      if (this.stageEdgeMat) {
        this.stageEdgeMat.color.setHSL((hue + 0.66) % 1, 0.9, 0.55);
      }
    }

    // Seated Avatars (seated naturally in chair)
    this.avatarMeshes.forEach((av, i) => {
      if (av && this.seatCoords[i]) {
        av.position.y = (this.seatCoords[i].y + 0.35) + Math.sin(time * 2 + i) * 0.015;
      }
    });

    // Subtle Cinema Subwoofer Pulse (Rung màng loa siêu trầm rạp chiếu phim)
    if (this.subwooferMeshes && this.subwooferMeshes.length) {
      const bassPulse = 1.0 + Math.sin(time * 6.5) * 0.035;
      for (let i = 0; i < this.subwooferMeshes.length; i++) {
        this.subwooferMeshes[i].scale.set(bassPulse, bassPulse, 1.0);
      }
    }

    // Floating Emojis
    for (let i = this.floatingParticles.length - 1; i >= 0; i--) {
      const p = this.floatingParticles[i];
      p.sprite.position.y += p.vy * delta;
      p.sprite.position.x += p.vx * delta;
      p.opacity -= delta * 0.45;
      p.sprite.material.opacity = Math.max(0, p.opacity);

      if (p.opacity <= 0 || p.sprite.position.y > 9) {
        this.scene.remove(p.sprite);
        p.sprite.material.map.dispose();
        p.sprite.material.dispose();
        this.floatingParticles.splice(i, 1);
      }
    }

    // Render WebGL and CSS3D
    if (this.hasWebGL && this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
    if (this.cssRenderer && this.cssScene) {
      this.cssRenderer.render(this.cssScene, this.camera);
    }
  }
}
