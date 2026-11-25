(() => {
  const STORAGE_KEY = 'lunch_roulette_menus_v1';
  const SPIN_DURATION_MS = 2000;
  const POINTER_ANGLE = -Math.PI / 2; // 12시 방향 포인터
  const SLICE_PALETTE = [
    '#FF6B35',
    '#FFB703',
    '#4EA8DE',
    '#52B788',
    '#F28482',
    '#9B5DE5',
    '#00BBF9',
    '#F77F00',
    '#80ED99',
    '#E07A5F',
  ];

  const wheelCanvas = document.getElementById('wheelCanvas');
  const ctx = wheelCanvas.getContext('2d');
  const spinBtn = document.getElementById('spinBtn');
  const resultBox = document.getElementById('resultBox');
  const resultText = document.getElementById('resultText');
  const menuForm = document.getElementById('menuForm');
  const menuInput = document.getElementById('menuInput');
  const addBtn = document.getElementById('addBtn');
  const formHint = document.getElementById('formHint');
  const menuList = document.getElementById('menuList');
  const menuCount = document.getElementById('menuCount');
  const emptyState = document.getElementById('emptyState');

  let menus = loadMenus();
  let currentRotation = 0;
  let isSpinning = false;
  let animationFrameId = null;

  function loadMenus() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0);
    } catch {
      return [];
    }
  }

  function saveMenus() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(menus));
    } catch {
      // localStorage 사용 불가 환경에서도 앱 동작은 유지
    }
  }

  function getSliceColor(index) {
    return SLICE_PALETTE[index % SLICE_PALETTE.length];
  }

  function getContrastTextColor(hexColor) {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.65 ? '#2A211B' : '#FFFFFF';
  }

  function truncateLabel(text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let trimmed = text;
    while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    return `${trimmed}…`;
  }

  function resizeCanvasForDpr() {
    const dpr = window.devicePixelRatio || 1;
    const cssSize = wheelCanvas.clientWidth || 380;
    const targetSize = Math.round(cssSize * dpr);
    if (wheelCanvas.width !== targetSize || wheelCanvas.height !== targetSize) {
      wheelCanvas.width = targetSize;
      wheelCanvas.height = targetSize;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return cssSize;
  }

  function drawWheel() {
    const size = resizeCanvasForDpr();
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 8;

    ctx.clearRect(0, 0, size, size);

    if (menus.length === 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#FFF9F2';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = '#DFD1C0';
      ctx.stroke();

      ctx.fillStyle = '#8C7D70';
      ctx.font = '700 16px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('메뉴를 추가해 주세요', cx, cy);
      ctx.restore();
      return;
    }

    const sliceAngle = (Math.PI * 2) / menus.length;

    // 바깥 테두리 그림자
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(42, 33, 27, 0.14)';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.restore();

    for (let i = 0; i < menus.length; i += 1) {
      const startAngle = currentRotation + i * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      const fillColor = getSliceColor(i);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // 조각 내부 메뉴 텍스트
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + sliceAngle / 2);

      const fontSize = menus.length > 10 ? 12 : menus.length > 6 ? 14 : 16;
      ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif`;
      ctx.fillStyle = getContrastTextColor(fillColor);
      ctx.textAlign = menus.length === 1 ? 'center' : 'right';
      ctx.textBaseline = 'middle';

      const textRadius = menus.length === 1 ? 0 : radius - 22;
      const maxLabelWidth = menus.length === 1 ? radius * 1.4 : radius * 0.62;
      const label = truncateLabel(menus[i], maxLabelWidth);
      ctx.fillText(label, textRadius, 0);
      ctx.restore();
    }

    // 중앙 원형 허브
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#EADFD2';
    ctx.stroke();
  }

  function getWinnerIndex(rotation) {
    const sliceAngle = (Math.PI * 2) / menus.length;
    const relative = (((POINTER_ANGLE - rotation) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return Math.floor(relative / sliceAngle) % menus.length;
  }

  function setControlsDisabled(disabled) {
    spinBtn.disabled = disabled || menus.length === 0;
    addBtn.disabled = disabled;
    menuInput.disabled = disabled;
    const deleteButtons = menuList.querySelectorAll('.delete-btn');
    deleteButtons.forEach((btn) => {
      btn.disabled = disabled;
    });
  }

  function showResult(menuName, isWinner) {
    resultBox.classList.remove('is-popping');
    if (isWinner && menuName) {
      resultBox.classList.add('has-winner');
      resultText.classList.remove('is-placeholder');
      resultText.textContent = menuName;
      // 애니메이션 재실행 트리거
      void resultBox.offsetWidth;
      resultBox.classList.add('is-popping');
    } else {
      resultBox.classList.remove('has-winner');
      resultText.classList.add('is-placeholder');
      resultText.textContent = menus.length === 0
        ? '메뉴를 추가하고 돌려보세요'
        : '돌리기 버튼을 눌러보세요';
    }
  }

  function renderMenuList() {
    menuList.innerHTML = '';
    menuCount.textContent = `${menus.length}개`;
    emptyState.classList.toggle('is-hidden', menus.length > 0);

    menus.forEach((menu, index) => {
      const li = document.createElement('li');
      li.className = 'menu-item';

      const info = document.createElement('div');
      info.className = 'menu-item-info';

      const dot = document.createElement('span');
      dot.className = 'color-dot';
      dot.style.backgroundColor = getSliceColor(index);
      dot.setAttribute('aria-hidden', 'true');

      const nameSpan = document.createElement('span');
      nameSpan.className = 'menu-name';
      nameSpan.textContent = menu;

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = '삭제';
      deleteBtn.setAttribute('aria-label', `${menu} 삭제`);
      deleteBtn.addEventListener('click', () => removeMenu(index));

      info.appendChild(dot);
      info.appendChild(nameSpan);
      li.appendChild(info);
      li.appendChild(deleteBtn);
      menuList.appendChild(li);
    });

    setControlsDisabled(isSpinning);
  }

  function addMenu(rawValue) {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      formHint.textContent = '메뉴 이름을 입력해 주세요.';
      return;
    }
    if (menus.includes(trimmed)) {
      formHint.textContent = '이미 목록에 있는 메뉴입니다.';
      return;
    }

    formHint.textContent = '';
    menus.push(trimmed);
    saveMenus();
    menuInput.value = '';
    menuInput.focus();

    renderMenuList();
    drawWheel();
    if (!resultBox.classList.contains('has-winner')) {
      showResult(null, false);
    }
  }

  function removeMenu(index) {
    if (isSpinning) return;
    menus.splice(index, 1);
    saveMenus();
    formHint.textContent = '';
    renderMenuList();
    drawWheel();
    if (menus.length === 0) {
      showResult(null, false);
    }
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function spinWheel() {
    if (isSpinning || menus.length === 0) return;

    isSpinning = true;
    setControlsDisabled(true);
    formHint.textContent = '';
    resultBox.classList.remove('has-winner', 'is-popping');
    resultText.classList.add('is-placeholder');
    resultText.textContent = '두구두구… 고르는 중!';

    const sliceAngle = (Math.PI * 2) / menus.length;
    const targetIndex = Math.floor(Math.random() * menus.length);
    const sliceOffset = (0.18 + Math.random() * 0.64) * sliceAngle;
    const targetLocalAngle = targetIndex * sliceAngle + sliceOffset;

    const twoPi = Math.PI * 2;
    const desiredFinalMod = (((POINTER_ANGLE - targetLocalAngle) % twoPi) + twoPi) % twoPi;
    const currentMod = ((currentRotation % twoPi) + twoPi) % twoPi;
    const alignDelta = (desiredFinalMod - currentMod + twoPi) % twoPi;
    const extraFullSpins = 5 * twoPi;
    const totalDelta = extraFullSpins + alignDelta;

    const startRotation = currentRotation;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / SPIN_DURATION_MS, 1);
      const eased = easeOutCubic(progress);

      currentRotation = startRotation + totalDelta * eased;
      drawWheel();

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        animationFrameId = null;
        isSpinning = false;
        const winnerIndex = getWinnerIndex(currentRotation);
        const winnerMenu = menus[winnerIndex];
        setControlsDisabled(false);
        showResult(winnerMenu, true);
      }
    }

    animationFrameId = requestAnimationFrame(step);
  }

  menuForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (isSpinning) return;
    addMenu(menuInput.value);
  });

  spinBtn.addEventListener('click', spinWheel);

  window.addEventListener('resize', () => {
    drawWheel();
  });

  window.addEventListener('beforeunload', () => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
  });

  // 초기 렌더링
  renderMenuList();
  drawWheel();
  showResult(null, false);
})();
