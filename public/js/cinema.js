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

    // Quality setting: 'high' | 'smooth'
    this.quality = 'smooth';
    this.partyMode = false;

    // Camera state & targets for smooth interpolation (lerp)
    this.cameraMode = 'overview'; // 'overview' | 'seat' | 'screen' | 'audience'
    this.camTargetPos = new THREE.Vector3(0, 8.2, 11.0);
    this.camTargetLook = new THREE.Vector3(0, 3.6, -2.5);
    this.camCurrentLook = new THREE.Vector3(0, 3.6, -2.5);

    // Mouse drag orbit offsets
    this.mouseOffsetX = 0;
    this.mouseOffsetY = 0;
    this.targetMouseX = 0;
    this.targetMouseY = 0;
    this.isDragging = false;
    this.lastMousePos = { x: 0, y: 0 };

    // 10 Seats Coordinates
    // Row A: 5 front seats (y = 0.5, z = -1.5)
    // Row B: 5 back seats on elevated step (y = 1.3, z = 2.4)
    this.seatCoords = [
      { id: 0, label: 'A01', x: -4.8, y: 0.5, z: -1.5 },
      { id: 1, label: 'A02', x: -2.4, y: 0.5, z: -1.5 },
      { id: 2, label: 'A03', x: 0.0,  y: 0.5, z: -1.5 },
      { id: 3, label: 'A04', x: 2.4,  y: 0.5, z: -1.5 },
      { id: 4, label: 'A05', x: 4.8,  y: 0.5, z: -1.5 },
      { id: 5, label: 'B01', x: -4.8, y: 1.3, z: 2.4 },
      { id: 6, label: 'B02', x: -2.4, y: 1.3, z: 2.4 },
      { id: 7, label: 'B03', x: 0.0,  y: 1.3, z: 2.4 },
      { id: 8, label: 'B04', x: 2.4,  y: 1.3, z: 2.4 },
      { id: 9, label: 'B05', x: 4.8,  y: 1.3, z: 2.4 }
    ];

    // Meshes references
    this.seatMeshes = [];      // 10 seats
    this.avatarMeshes = [];    // 10 seated avatars
    this.stageAvatar = null;   // Avatar on stage
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

    this.clock = new THREE.Clock();
    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 1. WebGL Scene & Camera
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 100);
    this.camera.position.set(0, 8.2, 11.0);
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
    const hallWidth = 20;
    const hallLength = 26;
    const hallHeight = 11;

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x161816,
      roughness: 0.85,
      metalness: 0.1
    });

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x111311,
      roughness: 0.9,
      metalness: 0.15
    });

    const woodStageMat = new THREE.MeshStandardMaterial({
      color: 0x241d17,
      roughness: 0.45,
      metalness: 0.2
    });

    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf2cf78,
      roughness: 0.3,
      metalness: 0.8,
      emissive: 0x705218,
      emissiveIntensity: 0.2
    });

    // 1. Tiered Cinema Floor
    // Front level: y = 0
    const frontFloorGeo = new THREE.BoxGeometry(hallWidth, 0.4, 10);
    const frontFloor = new THREE.Mesh(frontFloorGeo, floorMat);
    frontFloor.position.set(0, -0.2, -3.5);
    frontFloor.receiveShadow = true;
    this.scene.add(frontFloor);

    // Back Tier (Elevated step for Row B): y = 0.8
    const backFloorGeo = new THREE.BoxGeometry(hallWidth, 1.2, 12);
    const backFloor = new THREE.Mesh(backFloorGeo, floorMat);
    backFloor.position.set(0, 0.2, 7.5);
    backFloor.receiveShadow = true;
    this.scene.add(backFloor);

    // Glowing step strip
    const stepStripGeo = new THREE.BoxGeometry(hallWidth, 0.06, 0.08);
    const stepStripMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const stepStrip = new THREE.Mesh(stepStripGeo, stepStripMat);
    stepStrip.position.set(0, 0.82, 1.48);
    this.scene.add(stepStrip);

    // 2. Front Stage Platform in front of screen: y = 0.4
    const stageGeo = new THREE.BoxGeometry(16, 0.6, 4.2);
    const stage = new THREE.Mesh(stageGeo, woodStageMat);
    stage.position.set(0, 0.3, -6.8);
    stage.receiveShadow = true;
    this.scene.add(stage);

    // Stage Front Edge Neon Gold Accent
    const stageEdgeGeo = new THREE.BoxGeometry(16.05, 0.08, 0.08);
    const stageEdgeMat = new THREE.MeshBasicMaterial({ color: 0xf2cf78 });
    const stageEdge = new THREE.Mesh(stageEdgeGeo, stageEdgeMat);
    stageEdge.position.set(0, 0.6, -4.68);
    this.scene.add(stageEdge);

    // 3. Walls & Ceiling
    const backWallGeo = new THREE.BoxGeometry(hallWidth + 2, hallHeight, 0.5);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, hallHeight / 2 - 0.2, -10.5);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    const rearWall = new THREE.Mesh(backWallGeo, wallMat);
    rearWall.position.set(0, hallHeight / 2 - 0.2, 13.5);
    this.scene.add(rearWall);

    const sideWallGeo = new THREE.BoxGeometry(0.5, hallHeight, hallLength);
    const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
    leftWall.position.set(-hallWidth / 2, hallHeight / 2 - 0.2, 0);
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
    rightWall.position.set(hallWidth / 2, hallHeight / 2 - 0.2, 0);
    this.scene.add(rightWall);

    // Decorative wall ribs
    for (let z = -7; z <= 10; z += 3.5) {
      const ribGeo = new THREE.BoxGeometry(0.2, hallHeight - 2, 1.2);
      const ribLeft = new THREE.Mesh(ribGeo, goldTrimMat);
      ribLeft.position.set(-hallWidth / 2 + 0.25, hallHeight / 2, z);
      this.scene.add(ribLeft);

      const ribRight = new THREE.Mesh(ribGeo, goldTrimMat);
      ribRight.position.set(hallWidth / 2 - 0.25, hallHeight / 2, z);
      this.scene.add(ribRight);
    }

    const ceilingGeo = new THREE.BoxGeometry(hallWidth + 2, 0.4, hallLength);
    const ceiling = new THREE.Mesh(ceilingGeo, wallMat);
    ceiling.position.set(0, hallHeight, 0);
    this.scene.add(ceiling);

    // Speaker Towers
    const speakerGeo = new THREE.BoxGeometry(1.2, 3.8, 1.2);
    const speakerMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.5 });
    const speakerL = new THREE.Mesh(speakerGeo, speakerMat);
    speakerL.position.set(-7.5, 2.2, -7.5);
    this.scene.add(speakerL);

    const speakerR = new THREE.Mesh(speakerGeo, speakerMat);
    speakerR.position.set(7.5, 2.2, -7.5);
    this.scene.add(speakerR);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(ambientLight);

    const warmKeyLight = new THREE.DirectionalLight(0xfff1d6, 0.65);
    warmKeyLight.position.set(0, 10, 5);
    this.scene.add(warmKeyLight);
  }

  buildScreenAndCSS3D() {
    const screenWidth = 14.2;
    const screenHeight = 8.0;

    // In WebGL, add the outer frame bezel behind the screen
    if (this.hasWebGL) {
      const frameGeo = new THREE.BoxGeometry(screenWidth + 0.9, screenHeight + 0.7, 0.3);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x070807, roughness: 0.7 });
      const screenFrame = new THREE.Mesh(frameGeo, frameMat);
      screenFrame.position.set(0, 5.2, -9.85);
      this.scene.add(screenFrame);

      // Glowing Neon Brand Text beneath screen: "✦ W E T U B E   C I N É   M I N I ✦"
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 1024;
      signCanvas.height = 128;
      const ctx = signCanvas.getContext('2d');
      ctx.fillStyle = '#060706';
      ctx.fillRect(0, 0, signCanvas.width, signCanvas.height);
      ctx.font = 'bold 44px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#f2cf78';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#f2cf78';
      ctx.shadowBlur = 25;
      ctx.fillText('✦ W E T U B E   C I N É   M I N I ✦', 512, 64);

      const signTex = new THREE.CanvasTexture(signCanvas);
      const signGeo = new THREE.PlaneGeometry(6.2, 0.8);
      const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true });
      const signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.set(0, 0.85, -9.4);
      this.scene.add(signMesh);

      // Warm Glow behind the screen
      const screenBackLight = new THREE.PointLight(0xf2cf78, 1.4, 15);
      screenBackLight.position.set(0, 5.2, -9.2);
      this.scene.add(screenBackLight);
    }

    // Attach CSS3DObject (YouTube Player DOM element)
    const screenElement = document.getElementById('screen-surface');
    if (screenElement && typeof THREE.CSS3DObject !== 'undefined' && this.cssScene) {
      this.cssScreenObject = new THREE.CSS3DObject(screenElement);
      this.cssScreenObject.position.set(0, 5.2, -9.6);
      const scaleFactor = screenWidth / 1280;
      this.cssScreenObject.scale.set(scaleFactor, scaleFactor, scaleFactor);
      this.cssScene.add(this.cssScreenObject);
    }
  }

  buildSeats() {
    const leatherRed = new THREE.MeshStandardMaterial({
      color: 0x7a1e28, // Luxurious dark red velvet / leather
      roughness: 0.65,
      metalness: 0.15
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

    this.seatCoords.forEach((coord) => {
      const seatGroup = new THREE.Group();
      seatGroup.position.set(coord.x, coord.y, coord.z);

      // Seat Base
      const baseGeo = new THREE.BoxGeometry(1.3, 0.2, 1.1);
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.set(0, 0.1, 0);
      seatGroup.add(base);

      // Cushion
      const cushionGeo = new THREE.BoxGeometry(1.2, 0.35, 1.05);
      const cushion = new THREE.Mesh(cushionGeo, leatherRed);
      cushion.position.set(0, 0.35, -0.05);
      seatGroup.add(cushion);

      // Backrest
      const backGeo = new THREE.BoxGeometry(1.2, 1.25, 0.28);
      const backrest = new THREE.Mesh(backGeo, leatherRed);
      backrest.position.set(0, 1.05, 0.44);
      backrest.rotation.x = -0.12;
      seatGroup.add(backrest);

      // Headrest Pillow
      const headGeo = new THREE.BoxGeometry(0.85, 0.32, 0.18);
      const headrest = new THREE.Mesh(headGeo, leatherRed);
      headrest.position.set(0, 1.62, 0.48);
      seatGroup.add(headrest);

      // Armrests
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

      // Seat Number Label Plate ("A01", "B03"...)
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 128;
      labelCanvas.height = 64;
      const lCtx = labelCanvas.getContext('2d');
      lCtx.fillStyle = '#222522';
      lCtx.fillRect(0, 0, 128, 64);
      lCtx.strokeStyle = '#f2cf78';
      lCtx.lineWidth = 4;
      lCtx.strokeRect(2, 2, 124, 60);
      lCtx.font = 'bold 34px "JetBrains Mono", monospace';
      lCtx.fillStyle = '#f2cf78';
      lCtx.textAlign = 'center';
      lCtx.textBaseline = 'middle';
      lCtx.fillText(coord.label, 64, 34);

      const labelTex = new THREE.CanvasTexture(labelCanvas);
      const labelGeo = new THREE.PlaneGeometry(0.38, 0.18);
      const labelMat = new THREE.MeshBasicMaterial({ map: labelTex });
      const labelMesh = new THREE.Mesh(labelGeo, labelMat);
      labelMesh.position.set(0, 1.48, 0.59);
      seatGroup.add(labelMesh);

      seatGroup.userData = { seatId: coord.id, label: coord.label, coord };
      cushion.userData = { seatId: coord.id, parentGroup: seatGroup };
      backrest.userData = { seatId: coord.id, parentGroup: seatGroup };

      this.scene.add(seatGroup);
      this.seatMeshes[coord.id] = seatGroup;
      this.avatarMeshes[coord.id] = null;
    });
  }

  buildDiscoBallAndLights() {
    this.discoBallGroup = new THREE.Group();
    this.discoBallGroup.position.set(0, 9.4, 0);

    const rodGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.6, 8);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.2 });
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.position.set(0, 0.8, 0);
    this.discoBallGroup.add(rod);

    const sphereGeo = new THREE.IcosahedronGeometry(0.85, 3);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
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
      spot.position.set(spotOffsets[i].x, 8.5, spotOffsets[i].z);
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
      laser.position.set((i - 1.5) * 3, 7.5, 0);
      laser.rotation.x = Math.PI / 2.3;
      this.scene.add(laser);
      this.laserBeams.push(laser);
    }
  }

  setPartyMode(active) {
    this.partyMode = active;
    const intensity = active ? 4.5 : 0;
    this.spotlights.forEach((spot) => {
      spot.intensity = intensity;
    });

    this.laserBeams.forEach((laser) => {
      laser.material.opacity = active ? 0.65 : 0;
    });
  }

  // Update All 10 Seats for Real Users
  updateSeats(seatsData) {
    if (!seatsData || !this.hasWebGL) return;

    for (let i = 0; i < 10; i++) {
      const occupant = seatsData[i];
      if (occupant) {
        if (!this.avatarMeshes[i] || this.avatarMeshes[i].userData.userId !== occupant.userId) {
          this.removeAvatarFromSeat(i);
          this.createAvatarAtSeat(i, occupant);
        }
      } else {
        this.removeAvatarFromSeat(i);
      }
    }
  }

  createAvatarAtSeat(seatId, user) {
    const coord = this.seatCoords[seatId];
    if (!coord) return;

    const avatarGroup = new THREE.Group();
    avatarGroup.position.set(coord.x, coord.y + 0.35, coord.z + 0.1);
    avatarGroup.userData = { userId: user.userId || user.id };

    const shirtColor = new THREE.Color(user.color || '#3b82f6');
    const torsoGeo = new THREE.CylinderGeometry(0.32, 0.28, 0.65, 16);
    const torsoMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.6 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.set(0, 0.45, 0);
    avatarGroup.add(torso);

    const headGeo = new THREE.SphereGeometry(0.32, 24, 24);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdfc4, roughness: 0.5 });
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 0.95, 0);
    avatarGroup.add(head);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const eyeGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.11, 0.98, -0.3);
    avatarGroup.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.11, 0.98, -0.3);
    avatarGroup.add(eyeR);

    // Name Tag
    const nameSprite = this.createNameTagSprite(user.name, user.tier, user.color);
    nameSprite.position.set(0, 1.55, 0);
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

  updateStageUser(stageUserId, allUsers, meId) {
    if (!this.hasWebGL) return;

    if (!stageUserId) {
      if (this.stageAvatar) {
        this.scene.remove(this.stageAvatar);
        this.stageAvatar = null;
      }
      return;
    }

    const userData = allUsers.find(u => u.id === stageUserId) || {
      id: stageUserId,
      name: stageUserId === meId ? 'Bạn' : 'Người Xem',
      color: '#f59e0b',
      tier: 'Khán Giả'
    };

    if (!this.stageAvatar || this.stageAvatar.userData.userId !== stageUserId) {
      if (this.stageAvatar) this.scene.remove(this.stageAvatar);

      const avatarGroup = new THREE.Group();
      avatarGroup.position.set(0, 0.7, -6.6);
      avatarGroup.userData = { userId: stageUserId };

      const shirtColor = new THREE.Color(userData.color || '#ec4899');
      const torsoGeo = new THREE.CylinderGeometry(0.36, 0.3, 0.8, 16);
      const torsoMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.5 });
      const torso = new THREE.Mesh(torsoGeo, torsoMat);
      torso.position.set(0, 0.55, 0);
      avatarGroup.add(torso);

      const headGeo = new THREE.SphereGeometry(0.36, 24, 24);
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdfc4, roughness: 0.5 });
      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.set(0, 1.15, 0);
      avatarGroup.add(head);

      const nameSprite = this.createNameTagSprite('🕺 ' + userData.name, 'Đang Quẩy', userData.color);
      nameSprite.position.set(0, 1.85, 0);
      avatarGroup.add(nameSprite);

      this.scene.add(avatarGroup);
      this.stageAvatar = avatarGroup;
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
    sprite.scale.set(1.9, 0.52, 1);
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

  spawnEmojiReaction(emoji, seatId, isOnStage) {
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
    ctx.font = '72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(startPos);
    sprite.scale.set(0.9, 0.9, 1);

    this.scene.add(sprite);

    this.floatingParticles.push({
      sprite,
      vy: 1.8 + Math.random() * 0.8,
      vx: (Math.random() - 0.5) * 0.6,
      opacity: 1.0
    });
  }

  setCameraMode(mode, mySeatId = null) {
    this.cameraMode = mode;
    this.mouseOffsetX = 0;
    this.mouseOffsetY = 0;

    switch (mode) {
      case 'overview':
        this.camTargetPos.set(0, 8.2, 11.0);
        this.camTargetLook.set(0, 3.6, -2.5);
        break;

      case 'seat':
        if (mySeatId !== null && this.seatCoords[mySeatId]) {
          const s = this.seatCoords[mySeatId];
          this.camTargetPos.set(s.x, s.y + 1.25, s.z + 0.1);
          this.camTargetLook.set(s.x * 0.15, 4.8, -9.6);
        } else {
          this.camTargetPos.set(0, 1.75, -1.4);
          this.camTargetLook.set(0, 4.8, -9.6);
        }
        break;

      case 'screen':
        this.camTargetPos.set(0, 5.2, -1.8);
        this.camTargetLook.set(0, 5.2, -9.6);
        break;

      case 'audience':
        this.camTargetPos.set(0, 2.2, -7.0);
        this.camTargetLook.set(0, 1.8, 2.0);
        break;
    }
  }

  toggleTheater2DMode(forceState = null) {
    const viewport = document.getElementById('cinema-viewport');
    if (!viewport) return false;
    const is2D = forceState !== null ? forceState : !viewport.classList.contains('theater-2d-mode');
    if (is2D) {
      viewport.classList.add('theater-2d-mode');
      this.pause();
    } else {
      viewport.classList.remove('theater-2d-mode');
      this.resume();
    }
    return is2D;
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
      if (quality === 'smooth') {
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = false;
      } else {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        this.renderer.shadowMap.enabled = false;
      }
    }
  }

  onPointerDown(e) {
    this.isDragging = true;
    this.lastMousePos = { x: e.clientX, y: e.clientY };
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
    }
  }

  onPointerUp() {
    this.isDragging = false;
  }

  checkSeatHover() {
    if (!this.hasWebGL || this.isPaused) return;

    // Throttle seat hover checks to max 13fps (~75ms)
    const now = performance.now();
    if (now - this.lastHoverCheck < 75) return;
    this.lastHoverCheck = now;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    // Raycast only seat meshes (10 objects) instead of the entire scene tree (hundreds of objects)
    const targets = this.seatMeshes.filter(Boolean);
    const intersects = this.raycaster.intersectObjects(targets, true);

    let foundSeat = null;
    for (const hit of intersects) {
      let obj = hit.object;
      while (obj && obj.userData?.seatId === undefined && obj.parent) {
        obj = obj.parent;
      }
      if (obj && obj.userData?.seatId !== undefined) {
        foundSeat = obj.userData.seatId;
        break;
      }
    }

    if (foundSeat !== this.hoveredSeat) {
      this.hoveredSeat = foundSeat;
      this.container.style.cursor = foundSeat !== null ? 'pointer' : (this.isDragging ? 'grabbing' : 'grab');
    }
  }

  onClick(e) {
    if (!this.hasWebGL || this.isPaused) return;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const targets = this.seatMeshes.filter(Boolean);
    const intersects = this.raycaster.intersectObjects(targets, true);

    for (const hit of intersects) {
      let obj = hit.object;
      while (obj && obj.userData?.seatId === undefined && obj.parent) {
        obj = obj.parent;
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

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.getElapsedTime();

    // Camera Lerp
    this.mouseOffsetX += (this.targetMouseX - this.mouseOffsetX) * 0.08;
    this.mouseOffsetY += (this.targetMouseY - this.mouseOffsetY) * 0.08;

    const targetPos = this.camTargetPos.clone();
    targetPos.x += Math.sin(this.mouseOffsetX) * 3;
    targetPos.y += this.mouseOffsetY * 2;

    this.camera.position.lerp(targetPos, 0.06);
    this.camCurrentLook.lerp(this.camTargetLook, 0.06);
    this.camera.lookAt(this.camCurrentLook);

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
    }

    // Stage Dancer
    if (this.stageAvatar) {
      this.stageAvatar.position.y = 0.7 + Math.abs(Math.sin(time * 6)) * 0.22;
      this.stageAvatar.rotation.y = Math.sin(time * 4) * 0.35;
    }

    // Seated Avatars
    this.avatarMeshes.forEach((av, i) => {
      if (av && this.seatCoords[i]) {
        av.position.y = (this.seatCoords[i].y + 0.35) + Math.sin(time * 2 + i) * 0.015;
      }
    });

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
