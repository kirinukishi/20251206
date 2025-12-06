const { Engine, Render, Runner, World, Bodies, Body, Events, Composite, Mouse, MouseConstraint } = Matter;

// Game Config
const GAME_WIDTH = 500;
const GAME_HEIGHT = 800; // Aspect ratio roughly 9:16
const WALL_THICKNESS = 60;

// Character Definitions (10 stages)
// Radii are approximate, will need tuning
const CHARACTERS = [
    { radius: 25, img: 'assets/piyo_0.png', w: 64, h: 62, label: 'Piyo 1' },
    { radius: 35, img: 'assets/piyo_1.png', w: 79, h: 86, label: 'Piyo 2' },
    { radius: 45, img: 'assets/piyo_2.png', w: 114, h: 101, label: 'Piyo 3' },
    { radius: 55, img: 'assets/piyo_3.png', w: 113, h: 115, label: 'Piyo 4' },
    { radius: 65, img: 'assets/piyo_4.png', w: 132, h: 133, label: 'Piyo 5' },
    { radius: 80, img: 'assets/piyo_5.png', w: 168, h: 142, label: 'Piyo 6' },
    { radius: 95, img: 'assets/piyo_6.png', w: 213, h: 162, label: 'Piyo 7' },
    { radius: 110, img: 'assets/piyo_7.png', w: 213, h: 169, label: 'Piyo 8' },
    { radius: 125, img: 'assets/piyo_8.png', w: 188, h: 181, label: 'Piyo 9' },
    { radius: 150, img: 'assets/piyo_9.png', w: 260, h: 243, label: 'Piyo 10' }
];

// Spawn Logic
// Spawn Piyo 1 (index 0) to Piyo 7 (index 6). Piyo 8-10 do not spawn.
const SPAWNABLE_INDICES = [0, 1, 2, 3, 4, 5, 6];
const SPAWN_WEIGHTS = [0.3, 0.2, 0.15, 0.1, 0.1, 0.1, 0.05]; // Higher chance for smaller

let engine;
let render;
let runner;
let currentFruit = null;
let isDropping = false;
let score = 0;
let nextFruitIndex = getRandomSpawnIndex();

function init() {
    // Create Engine
    engine = Engine.create({
        positionIterations: 20, // High iterations to prevent overlap
        velocityIterations: 20,
        constraintIterations: 10
    });
    engine.world.gravity.y = 1.5; // Slightly heavier gravity for better feeling

    // Create Renderer
    const canvas = document.getElementById('game-canvas');
    const container = document.getElementById('game-container');

    // Adjust size to container
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    render = Render.create({
        canvas: canvas,
        engine: engine,
        options: {
            width: rect.width,
            height: rect.height,
            wireframes: false,
            background: 'transparent',
            pixelRatio: window.devicePixelRatio // Sharper rendering
        }
    });

    // Create Walls
    const ground = Bodies.rectangle(rect.width / 2, rect.height + WALL_THICKNESS / 2 - 10, rect.width, WALL_THICKNESS, { isStatic: true, render: { fillStyle: '#5D4037' } });
    const leftWall = Bodies.rectangle(0 - WALL_THICKNESS / 2, rect.height / 2, WALL_THICKNESS, rect.height * 2, { isStatic: true, render: { fillStyle: '#5D4037' } });
    const rightWall = Bodies.rectangle(rect.width + WALL_THICKNESS / 2, rect.height / 2, WALL_THICKNESS, rect.height * 2, { isStatic: true, render: { fillStyle: '#5D4037' } });

    World.add(engine.world, [ground, leftWall, rightWall]);

    // Input Handling
    canvas.addEventListener('mousemove', handleInputMove);
    canvas.addEventListener('touchmove', handleInputMove, { passive: false });
    canvas.addEventListener('click', handleInputClick);
    canvas.addEventListener('touchend', handleInputClick);

    // BGM Toggle
    const bgmBtn = document.getElementById('bgm-toggle');
    // Use mousedown/touchstart to catch it before canvas click if possible, 
    // or just rely on stopPropagation in the click handler, but we need to ensure UI layer allows clicks.
    bgmBtn.addEventListener('click', toggleBGM);
    bgmBtn.addEventListener('touchstart', toggleBGM, { passive: false });

    // Collision Handling (Merge Logic)
    // Use collisionActive to catch bodies that are already overlapping
    Events.on(engine, 'collisionStart', handleCollisions);
    Events.on(engine, 'collisionActive', handleCollisions);

    // Render Guide Line and Danger Line
    Events.on(render, 'afterRender', () => {
        renderGuideLine();
        renderDangerLine();
    });

    // Game Over Check
    Events.on(engine, 'afterUpdate', checkGameOver);

    // Start
    Render.run(render);
    runner = Runner.create();
    Runner.run(runner, engine);

    // Spawn first fruit to hold
    createNewCurrentFruit();
    updateUI();

    // Populate Evolution Guide
    const guideList = document.getElementById('guide-list');
    CHARACTERS.forEach((char, index) => {
        const item = document.createElement('div');
        item.className = 'guide-item';

        const img = document.createElement('img');
        img.src = char.img;
        img.className = 'guide-img';

        const label = document.createElement('span');
        label.innerText = index + 1; // 1-based index
        label.style.fontWeight = 'bold';

        item.appendChild(label);
        item.appendChild(img);

        if (index < CHARACTERS.length - 1) {
            const arrow = document.createElement('span');
            arrow.className = 'guide-arrow';
            arrow.innerText = '↓';
            // item.appendChild(arrow); // Arrow inside item or between? Let's keep it simple
        }

        guideList.appendChild(item);
    });
}

// Track last mouse X for spawning
let lastMouseX = 250; // Default center
let isBGMEnabled = true;

function toggleBGM(e) {
    // Stop propagation so we don't drop a fruit when clicking the button
    e.stopPropagation();

    const bgm = document.getElementById('bgm');
    const btn = document.getElementById('bgm-toggle');

    isBGMEnabled = !isBGMEnabled;

    if (isBGMEnabled) {
        bgm.play();
        btn.innerText = 'BGM ON';
        btn.style.background = '#fff';
        btn.style.color = 'var(--text-color)';
    } else {
        bgm.pause();
        btn.innerText = 'BGM OFF';
        btn.style.background = '#ddd';
        btn.style.color = '#888';
    }
}

function getRandomSpawnIndex() {
    const r = Math.random();
    let sum = 0;
    for (let i = 0; i < SPAWNABLE_INDICES.length; i++) {
        sum += SPAWN_WEIGHTS[i];
        if (r < sum) return SPAWNABLE_INDICES[i];
    }
    return 0; // Fallback
}

function createNewCurrentFruit() {
    if (currentFruit) return;

    const index = nextFruitIndex;
    const char = CHARACTERS[index];
    const scale = getScale(char);

    // Create a sensor body (doesn't collide with world yet) for the "holding" phase

    // Dynamic Start Y: Ensure we spawn above the highest fruit
    let startY = 100;
    const bodies = Composite.allBodies(engine.world);
    let minY = render.canvas.height;

    bodies.forEach(b => {
        if (!b.isStatic && !b.isSensor && b.position.y < minY) {
            minY = b.position.y - b.circleRadius;
        }
    });

    // If pile is high, move spawn up, but clamp to a minimum margin
    if (minY < startY + char.radius + 10) {
        startY = Math.max(50, minY - char.radius - 10);
    }

    // Use last known mouse X, clamped to walls
    const radius = char.radius;
    const minX = radius + WALL_THICKNESS / 2 + 5;
    const maxX = render.canvas.width - radius - WALL_THICKNESS / 2 - 5;
    const startX = Math.max(minX, Math.min(lastMouseX, maxX));

    currentFruit = Bodies.circle(startX, startY, char.radius, {
        isSensor: true, // Don't collide yet
        isStatic: true, // Static so it doesn't fall
        label: `fruit_${index}`,
        slop: 0.05, // Reduce penetration allowance
        density: 0.002, // Slightly heavier
        render: {
            sprite: {
                texture: char.img,
                xScale: scale,
                yScale: scale
            }
        }
    });

    World.add(engine.world, currentFruit);

    // Prepare next
    nextFruitIndex = getRandomSpawnIndex();
    updateUI();
}

function playBGM() {
    if (!isBGMEnabled) return;
    const bgm = document.getElementById('bgm');
    if (bgm && bgm.paused) {
        bgm.volume = 0.3;
        bgm.play().catch(e => console.log("Audio play failed (user interaction needed):", e));
    }
}

function getScale(char) {
    return (char.radius * 2.3) / Math.max(char.w, char.h);
}

function handleInputMove(e) {
    const x = getEventX(e);
    lastMouseX = x; // Update global tracker

    if (!currentFruit || isDropping) return;
    e.preventDefault();

    // Clamp x
    const radius = currentFruit.circleRadius;
    const minX = radius + WALL_THICKNESS / 2 + 5;
    const maxX = render.canvas.width - radius - WALL_THICKNESS / 2 - 5;

    const clampedX = Math.max(minX, Math.min(x, maxX));

    // Move the static body
    Body.setPosition(currentFruit, { x: clampedX, y: currentFruit.position.y });
}

function handleInputClick(e) {
    playBGM(); // Ensure BGM starts on first click

    // Update lastMouseX on click too, just in case
    lastMouseX = getEventX(e);

    if (!currentFruit || isDropping) return;
    e.preventDefault();

    isDropping = true;

    // Make it a real physical body
    currentFruit.isSensor = false;
    Body.setStatic(currentFruit, false); // Properly wake up the body
    Body.setVelocity(currentFruit, { x: 0, y: 0 });

    // Add some friction/bounce properties
    currentFruit.restitution = 0.2;
    currentFruit.friction = 0.005;

    currentFruit = null;

    // Wait a bit before spawning next
    setTimeout(() => {
        isDropping = false;
        createNewCurrentFruit();
    }, 1000);
}

function getEventX(e) {
    const rect = render.canvas.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width; // Map CSS pixels to Canvas pixels

    let clientX = e.clientX;

    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
    }

    // Fallback
    if (clientX === undefined) {
        return lastMouseX;
    }

    return (clientX - rect.left) * scaleX;
}

function renderGuideLine() {
    if (!currentFruit || isDropping) return;

    const ctx = render.context;
    const x = currentFruit.position.x;
    const y = currentFruit.position.y;
    const radius = currentFruit.circleRadius;

    ctx.beginPath();
    ctx.moveTo(x, y + radius);
    ctx.lineTo(x, render.canvas.height - WALL_THICKNESS);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
}

function renderDangerLine() {
    const ctx = render.context;
    const y = 100; // Must match deadLineY in checkGameOver

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(render.canvas.width, y);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)'; // Semi-transparent red
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]); // Dashed line
    ctx.stroke();
    ctx.setLineDash([]);

    // Add text label
    ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
    ctx.font = 'bold 14px "M PLUS Rounded 1c", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('DANGER', render.canvas.width - 10, y - 5);
}

function handleCollisions(event) {
    const pairs = event.pairs;

    for (let i = 0; i < pairs.length; i++) {
        const bodyA = pairs[i].bodyA;
        const bodyB = pairs[i].bodyB;

        // Ignore collisions with the "holding" fruit (sensor)
        if (bodyA.isSensor || bodyB.isSensor) continue;

        // Check if both are fruits
        const indexA = getFruitIndex(bodyA);
        const indexB = getFruitIndex(bodyB);

        if (indexA !== -1 && indexB !== -1 && indexA === indexB) {
            // Merge!
            // Check if they are already being removed to avoid double-merge
            if (!bodyA.isRemoved && !bodyB.isRemoved) {
                bodyA.isRemoved = true;
                bodyB.isRemoved = true;

                World.remove(engine.world, [bodyA, bodyB]);

                if (indexA < CHARACTERS.length - 1) {
                    // Normal merge: Create new fruit
                    const newX = (bodyA.position.x + bodyB.position.x) / 2;
                    const newY = (bodyA.position.y + bodyB.position.y) / 2;
                    const newIndex = indexA + 1;
                    const newChar = CHARACTERS[newIndex];
                    const scale = getScale(newChar);

                    const newBody = Bodies.circle(newX, newY, newChar.radius, {
                        label: `fruit_${newIndex}`,
                        slop: 0.05,
                        density: 0.002,
                        render: {
                            sprite: {
                                texture: newChar.img,
                                xScale: scale,
                                yScale: scale
                            }
                        },
                        restitution: 0.2,
                        friction: 0.005
                    });

                    World.add(engine.world, newBody);

                    // Score update
                    score += (indexA + 1) * 10;
                } else {
                    // Max level merge: Just disappear and give bonus score
                    score += 1000;
                }

                updateUI();
            }
        }
    }
}

function getFruitIndex(body) {
    if (body.label && body.label.startsWith('fruit_')) {
        return parseInt(body.label.split('_')[1]);
    }
    return -1;
}

function updateUI() {
    document.getElementById('score').innerText = score;

    const nextPreview = document.getElementById('next-item-preview');
    const nextChar = CHARACTERS[nextFruitIndex];

    nextPreview.style.backgroundColor = 'transparent';
    nextPreview.style.backgroundImage = `url(${nextChar.img})`;
    nextPreview.style.backgroundSize = 'contain';
    nextPreview.style.backgroundRepeat = 'no-repeat';
    nextPreview.style.backgroundPosition = 'center';
}

// Init on load
window.onload = init;

let gameOverTimestamp = 0;
function checkGameOver() {
    if (isDropping) return; // Don't check while dropping

    const bodies = Composite.allBodies(engine.world);
    const deadLineY = 100; // Y position for game over (top area)

    for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];

        // Ignore walls, ground, and current holding fruit
        if (body.isStatic || body.isSensor || body === currentFruit) continue;

        // Check if top of the body is above the deadline
        // body.position.y is center, so top is y - radius
        // We use a small buffer (e.g. 10px) to be forgiving
        if (body.position.y - body.circleRadius < deadLineY - 10) {
            // Relaxed stability check: allow some movement, just check if it stays up there
            // Velocity < 1.0 is pretty slow (falling is usually much faster)
            if (Math.abs(body.velocity.y) < 1.0 && Math.abs(body.velocity.x) < 1.0) {
                if (gameOverTimestamp === 0) {
                    gameOverTimestamp = Date.now();
                } else if (Date.now() - gameOverTimestamp > 2000) {
                    // Trigger Game Over if condition persists for 2 seconds
                    triggerGameOver();
                }
                return;
            }
        }
    }

    // Reset timestamp if no danger
    gameOverTimestamp = 0;
}

function triggerGameOver() {
    // Stop the game
    Runner.stop(runner);
    Render.stop(render);

    // Show Game Over Screen
    const screen = document.getElementById('game-over-screen');
    screen.classList.remove('hidden');
}
