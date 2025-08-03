/*
TODO Add loading icon when opening idf files
TODO Add support for walls and windows object
*/
//+ ------------------------------------------------------------------- +//
//MARK: Basic Utilities

// import earcut from './earcut.js';

// Convert from degrees to radians.
Math.radians = function (degrees) {
    return degrees * Math.PI / 180;
}
// Convert from radians to degrees.
Math.degrees = function (radians) {
    return radians * 180 / Math.PI;
}
// Clamp number between two values with the following line:
const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

const roundFloat = (num, decplace) => Math.round(num * Math.pow(10, decplace)) / Math.pow(10, decplace);

const THRESHOLD = 10e-5;

const REFRESHRATE = 1 / 65;

//? Colors

function rgbToHex(rgb) {
    let r = parseInt(rgb.r * 255);
    let g = parseInt(rgb.g * 255);
    let b = parseInt(rgb.b * 255);
    let hex = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    // return parseInt(hex, 16);
    return '#' + hex;
}
function hexToRgb(h) {
    // hex = h.toString(16);
    let hex = h.slice(1);
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function (m, r, g, b) {
        return r + r + g + g + b + b;
    });

    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : null;
}
function add_white_color_rgb(color, alpha = 0.5) {
    let h_str;
    if (typeof (color) == 'string') {
        h_str = color;
    }
    else {
        h_str = rgbToHex(color);
    }
    let rgb = hexToRgb(h_str);
    return Object.fromEntries(
        Object.entries(rgb).map(([channel, c]) => [channel, c * alpha + (1 - alpha)])
    );
}
function add_white_color_hex(color, alpha = 0.5) {
    return rgbToHex(add_white_color_rgb(color, alpha));
}
function add_black_color_rgb(color, alpha = 0.5) {
    let h_str;
    if (typeof (color) == 'string') {
        h_str = color;
    }
    else {
        h_str = rgbToHex(color);
    }
    let rgb = hexToRgb(h_str);
    return Object.fromEntries(
        Object.entries(rgb).map(([channel, c]) => [channel, c * alpha])
    );
}
function add_black_color_hex(color, alpha = 0.5) {
    return rgbToHex(add_black_color_rgb(color, alpha));
}

//+ ------------------------------------------------------------------- +//
//MARK: Parameters

DEFAULTS = {
    // settings panel
    shadingOn: true,
    debugOn: false,
    lineThicknessOn: false,
    lineThickness: 1,
    hiddenMatType: 'ghost',
    transparencyOn: true,
    // materials
    materialBy: 'byType',
    overrideMatOn: false,
    matSettings: {
        'common': {
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.01
        },
        'templates': {
            'DefaultOpaque': { color: '#f5f5f5', opacity: 1.0 },
            'DefaultTransparent': { color: '#f5f5f5', opacity: 0.5 },
            'Opaque': { color: '#f72568', opacity: 1.0 },
            'Transparent': { color: '#f72568', opacity: 0.7 },
            'Shading': { color: '#f5f5f5', opacity: 0.8 }
        },
        'byType': {
            'Adiabatic': { color: '#f24b91', opacity: 0.8 },
            'Override': { color: '#f5f5f5', opacity: 1.0 },
            'Roof': { color: add_black_color_hex('#a82525', 0.7), opacity: 0.85 },
            'OuterWall': { color: '#ffe16b', opacity: 1.0 },
            'InnerSurf': { color: '#444444', opacity: 0.5 },
            'OuterSurf': { color: '#444444', opacity: 0.8 },
            'Window': { color: '#47dcff', opacity: 0.3 },
            'Door': { color: '#1747d4', opacity: 0.3 },
            'Shading': { color: '#624285', opacity: 0.7 },
            'Ground': { color: '#555555', opacity: 1.0 }
        },
        'byConst': {}
    },
    matTemplates: {
        'Disabled': new THREE.MeshPhongMaterial({
            color: '#bbbbbb',
            opacity: 0.2,
            side: THREE.DoubleSide,
            transparent: true
        })
    },
    // visibility panel
    visFilterType: 'zones',
    // shadow properties
    shadowOn: false,
    selfShadow: false,
    shadowRadius: 1,
    shadowMapSize: 1024,
    shadowOffset: new Array(45, 90),
    // scene
    sceneObjectKeys: ['surfMesh']
}

let readSuccess = false;
let idfName = "";
let idfExt = "";
let iddInfoLibrary = null;
let northAxis = 0;
let boundary = [];
let bldgRadius = 0;
let bldgCenter = new THREE.Vector3();

let zoneList = [];
let surfList = {};
let fenList = {};
let shadeList = {};
let sceneObjects = Object.fromEntries(DEFAULTS.sceneObjectKeys.map(k => [k, []]));

let shadowCatcher = null;

//+ ------------------------------------------------------------------- +//
//MARK: Materials

const matEdge = new THREE.LineBasicMaterial({
    color: 0x000000,
    linewidth: 1,
});
const matEdge2 = new LineMaterial({
    color: '#000000',
    linewidth: 1,
    alphaToCoverage: false,
    // worldUnits: true,
});

const axisLength = 10;
const axisXObjTemplate = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(axisLength, 0, 0),
    ]),
    new THREE.LineBasicMaterial({ color: 0xff0000 })
);
const axisYObjTemplate = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, axisLength, 0),
    ]),
    new THREE.LineBasicMaterial({ color: 0x00ff00 })
);
const axisZObjTemplate = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, axisLength),
    ]),
    new THREE.LineBasicMaterial({ color: 0x0000ff })
);
const axisTrueNorthObjTemplate = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, axisLength, 0),
    ]),
    new THREE.LineDashedMaterial({
        color: 0x00ff00,
        linewidth: 2,
        dashSize: 1.5,
        gapSize: 1
    })
);
axisTrueNorthObjTemplate.computeLineDistances();

let axisXObject = null;
let axisYObject = null;
let axisZObject = null;
let axisTrueNorthObject = null;

const shadowCatcherMat = new THREE.ShadowMaterial();
shadowCatcherMat.opacity = 0.5;

const matGhost = new THREE.MeshBasicMaterial({
    color: 0x000000,
    blending: THREE.AdditiveBlending,
    ...DEFAULTS.matSettings.common
});

let matSettings = {
    'byType': structuredClone(DEFAULTS.matSettings.byType),
    'byConst': {},
    'byConstDefault': {}
};

const materials = {
    'byType': {
        'Adiabatic': new THREE.MeshPhongMaterial(DEFAULTS.matSettings.byType['Adiabatic']),
        'Override': new THREE.MeshPhongMaterial(DEFAULTS.matSettings.byType['Override']),
        'Roof': new THREE.MeshPhongMaterial(DEFAULTS.matSettings.byType['Roof']),
        'OuterWall': new THREE.MeshLambertMaterial(DEFAULTS.matSettings.byType['OuterWall']),
        'InnerSurf': new THREE.MeshPhongMaterial(DEFAULTS.matSettings.byType['InnerSurf']),
        'OuterSurf': new THREE.MeshPhongMaterial(DEFAULTS.matSettings.byType['OuterSurf']),
        'Window': new THREE.MeshPhongMaterial(DEFAULTS.matSettings.byType['Window']),
        'Door': new THREE.MeshPhongMaterial(DEFAULTS.matSettings.byType['Door']),
        'Shading': new THREE.MeshPhongMaterial(DEFAULTS.matSettings.byType['Shading']),
        'Ground': new THREE.MeshLambertMaterial(DEFAULTS.matSettings.byType['Ground'])
    },
    'byConst': {},
    'byConstDefault': {}
}
for (const matGroup of Object.values(materials)) {
    for (const mat of Object.values(matGroup)) {
        for (const [key, prop] of Object.entries(DEFAULTS.matSettings.common)) {
            if (key == 'transparent' && mat.opacity == 1) {
                continue;  // don't set it to transparent if opacity is 1
            }
            mat[key] = prop;
        }
    }
}

//+ ------------------------------------------------------------------- +//
//MARK: Scene Setup

const scene = new THREE.Scene();
// scene.background = new THREE.Color(0xffffff);
//? transparent background
scene.background = null;

// const camera = new THREE.PerspectiveCamera(fov=30, aspect=canvWidth / canvHeight, near=0.1, far=1000);
// const camera = new THREE.PerspectiveCamera({fov:30, aspect:canvWidth / canvHeight, near:0.1, far:1000});
const camera = new THREE.PerspectiveCamera(30, canvWidth / canvHeight, 0.1, 1000);
camera.up = new THREE.Vector3(0, 0, 1);

// const lightDirect = new THREE.DirectionalLight(0xffffff, 1);
const lightDirect = new THREE.DirectionalLight(0xeeeeee, 0.6);  // 0.6
// lightDirect.castShadow = true;
// lightDirect.shadow.radius = 10;
const lightDirectTarget = new THREE.Object3D();
// const lightAmbient = new THREE.AmbientLight(0x777777);
const lightAmbient = new THREE.AmbientLight(0x888888, 1);
// const lightAmbient = new THREE.AmbientLight(0xffffff);
const lightShadow = new THREE.DirectionalLight(0xeeeeee, 0.0);
let shadowRadius = DEFAULTS.shadowRadius;
lightShadow.shadow.radius = shadowRadius;
// lightShadow.shadow.bias = -0.001;  // 그림자 줄무늬 방지
// lightShadow.shadow.normalBias = -0.0001;  // 그림자 줄무늬 방지
let shadowOffset = DEFAULTS.shadowOffset;
let shadowMapSize = DEFAULTS.shadowMapSize;
lightShadow.shadow.mapSize.width = shadowMapSize; // default 512
lightShadow.shadow.mapSize.height = shadowMapSize;
// lightShadow.shadow.camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.5, 1000);
// lightShadow.shadow.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.5, 1000);
const lightShadowTarget = new THREE.Object3D();

//? DEV MODE
let DEV = false;
const matDev = new THREE.MeshPhongMaterial({ color: 0xffff00 });
const geomDev = new THREE.SphereGeometry(3, 8, 4);
const objDev = new THREE.Mesh(geomDev, matDev);

//+ ------------------------------------------------------------------- +//
//MARK: Renderer

/*
? Render order
0: EdgeObject2 (두께 있는 테두리)
1: 일반 서피스 (surfMesh)
2: shadowCatcher
3: 숨김 처리된 서피스 (DEFAULTS.matTemplates.Disabled)
Infinity: shadowObject (그림자 만드는 오브젝트)
*/


// const renderer = new THREE.WebGLRenderer();
// const renderer = new THREE.WebGLRenderer({alpha: true});
//? 배경 투명하게
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
// const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
renderer.setClearColor(0xffffff, 0);
//? 배경 하얗게
// const renderer = new THREE.WebGLRenderer({alpha: false, antialias: true, preserveDrawingBuffer: true});
// renderer.setClearColor(0xffffff, 1);
//? 그림자 변경
// renderer.shadowMap.type = THREE.PCFSoftShadowMap;  // default: PCFShadowMap

renderer.setSize(canvWidth, canvHeight);
renderer.domElement.id = 'CanvasRenderer';
// document.body.appendChild(renderer.domElement);
document.getElementById("CanvasContainer").appendChild(renderer.domElement);
// renderer.domElement.style.width = panelWidth+"px";
// renderer.domElement.style.height = panelHeight+"px";
renderer.domElement.style.width = "100%";
renderer.domElement.style.height = "100%";

/*
TODO
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(panelWidth, panelHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.zIndex = '100';
// labelRenderer.domElement.style.width = "100%";
// labelRenderer.domElement.style.height = "100%";
// pointer-events: none;
labelRenderer.domElement.style.pointerEvents = 'none';
// document.body.appendChild( labelRenderer.domElement );
document.getElementById('CanvasContainer').appendChild(labelRenderer.domElement);
*/

// const CanvasRenderer = document.getElementById('CanvasRenderer');
const CanvasRenderer = renderer.domElement;

function exportImage(fname = '') {
    console.log('exporting image...');

    if (fname == '') {
        fname = idfName;
    }

    let image = CanvasRenderer.toDataURL('image/png').replace('image/png', 'image/octet-stream');
    let link = document.createElement("a");
    link.setAttribute("href", image);
    link.setAttribute("download", fname + ".png");
    document.body.appendChild(link);
    link.click();
    link.remove();
}

//+ ------------------------------------------------------------------- +//
//MARK: Settings Panel

const settingsPanelContent = document.getElementById('SettingsPanelContent');
const visibilityPanelContent = document.getElementById('VisibilityPanelContent');
const settingsPanelBlockZones = document.getElementById('SettingsPanelBlockZones');

const sttgsShading = document.getElementById('SttgsShading');
const sttgsLineThkCheckbox = document.getElementById('SttgsLineThkCheckbox');
const sttgsLineThkInputfield = document.getElementById('SttgsLineThkInputfield');
const sttgsHiddenMatType = document.getElementById('SttgsHiddenMatType');
const sttgsShadow = document.getElementById('SttgsShadow');
const sttgsDebug = document.getElementById('SttgsDebug');

//? 차양 설정
let shadingOn = DEFAULTS.shadingOn;
function turnOnShading(on) {
    shadingOn = on;
    sttgsShading.checked = on;
    updateModel(force = true, source = 'turnOnShading');
}

//? 그림자 설정
let shadowOn = DEFAULTS.shadowOn;
let selfShadow = DEFAULTS.selfShadow;
function turnOnShadow(on) {
    shadowOn = on;
    sttgsShadow.checked = on;
    renderer.shadowMap.enabled = on;
    lightShadow.castShadow = on;
    if (shadowOn) updateShadowProperties();
    updateModel(force = true, source = 'turnOnShadow');
}
function turnOnSelfShadow(on) {
    selfShadow = on;

    if (selfShadow) {
        lightShadow.shadow.normalBias = -0.1;  // 그림자 줄무늬 방지
    }
    else {
        lightShadow.shadow.normalBias = 0;
    }

    for (const surfMesh of sceneObjects.surfMesh) {
        surfMesh.receiveShadow = selfShadow;  // 자체 그림자
    }

    updateModel(force = true, source = 'turnOnSelfShadow');
}
function updateShadowProperties() {
    updateCamera(force = true, source = 'updateShadowProperties');  // 그림자 속성 업데이트를 위해 한 번 렌더링
    lightShadow.shadow.radius = shadowRadius;
    lightShadow.shadow.mapSize.width = shadowMapSize;
    lightShadow.shadow.mapSize.height = shadowMapSize;
    turnOnSelfShadow(selfShadow);
    if (lightShadow.shadow.map) {
        lightShadow.shadow.map.dispose();
    }
    lightShadow.shadow.map = null;
}

//? 디버그 설정
let debugOn = DEFAULTS.debugOn;
function turnOnDebug(on) {
    debugOn = on;
    sttgsDebug.checked = on;
    updateModel(force = true, source = 'turnOnDebug');
}

//? 선 두께 설정
let lineThicknessOn = DEFAULTS.lineThicknessOn;
let lineThickness = DEFAULTS.lineThickness;
const MAXLINETHICKNESS = 5 * canvMult;
let absoluteLineThickness = NaN;
function turnOnLineThickness(on) {
    lineThicknessOn = on;
    sttgsLineThkCheckbox.checked = on;
    sttgsLineThkInputfield.disabled = !lineThicknessOn;
    if (lineThicknessOn) {
        sttgsLineThkInputfield.value = lineThickness;
        sttgsLineThkInputfield.type = 'number';
        updateAbsoluteLineThickness();
    }
    else {
        sttgsLineThkInputfield.type = 'text';
        sttgsLineThkInputfield.value = '-';
    }
    updateModel(force = true, source = 'turnOnLineThickness');
}
function updateAbsoluteLineThickness() {
    absoluteLineThickness = lineThickness * bldgRadius / camera.radius * 1.4;
    matEdge2.linewidth = absoluteLineThickness;
}
updateAbsoluteLineThickness();
function updateLineThickness(thickness) {
    if (!isNaN(thickness)) {
        thickness = clamp(thickness, 0, MAXLINETHICKNESS);
        lineThickness = thickness;
    }
    if (lineThicknessOn) {
        sttgsLineThkInputfield.value = lineThickness;
        sttgsLineThkInputfield.blur();
        updateAbsoluteLineThickness();
    }
    updateModel(force = true, source = 'updateLineThickness');
}
function updateLineThicknessInputfield(e, inputfield) {
    const inputLineThickness = parseFloat(inputfield.value);
    // let infocus = (inputfield === document.activeElement);
    if (e === undefined || e.key === 'Escape') {
        inputfield.value = lineThickness;
        inputfield.blur();
    }
    else if (e === true || e.key === 'Enter') {
        updateLineThickness(inputLineThickness);
    }
}

//? 숨긴 오브젝트 재질
let hiddenMatType = DEFAULTS.hiddenMatType;
const hiddenMatTypeOptions = ['disable', 'wireframe', 'ghost'];
function changeHiddenMatType(matType) {
    if (!hiddenMatTypeOptions.includes(matType)) {
        console.error(`"${matType}" is not a valid option for hidden objects material!`);
        return;
    }
    sttgsHiddenMatType.value = matType;
    sttgsHiddenMatType.blur();
    hiddenMatType = matType;
    updateModel(force = true, source = 'changeHiddenMatType');
}

//+ ------------------------------------------------------------------- +//
//MARK: Materials

const sttgsMatTrans = document.getElementById('SttgsMatTrans');
const sttgsOverrideMat = document.getElementById('SttgsOverrideMat');

//? Material by
let materialBy = DEFAULTS.materialBy;

const sttgsBlockMatbyType = document.getElementById('SettingsPanelBlockMatbyType');
const sttgsBlockMatbyConst = document.getElementById('SettingsPanelBlockMatbyConst');

function changeMaterialBy(matBy) {
    Array.from(document.querySelectorAll('#SettingsPanelBlockMatBy .changeBackgroundColorBtn')).forEach((btn) => {
        if (btn.dataset.type == matBy) {
            btn.classList.add('changeBgColorBtnHighlighted');
            btn.disabled = true;
        }
        else {
            btn.classList.remove('changeBgColorBtnHighlighted');
            btn.disabled = false;
        }
    });

    materialBy = matBy;

    switch (matBy) {
        case 'byType':
            sttgsBlockMatbyType.style.display = 'block';
            sttgsBlockMatbyConst.style.display = 'none';
            break;

        case 'byConst':
            sttgsBlockMatbyType.style.display = 'none';
            sttgsBlockMatbyConst.style.display = 'block';
            break;

        default:
            break;
    }

    updateModel(force = true, source = 'changeMaterialBy');
}

const sttgsGroupMatbyType = document.getElementById('SttgGroupMatbyType');
const sttgsMatTemplatebyType = document.getElementById('MatSettingsbyType');

const matKeysbyType = {
    'Override': 'Override', // material override
    'OuterWall': 'Outer wall',
    'InnerSurf': 'Inner surface',
    'OuterSurf': 'Outer surface',
    'Roof': 'Roof',
    'Ground': 'Ground',
    'Adiabatic': 'Adiabatic',
    'Window': 'Window',
    'Door': 'Door',
    'Shading': 'Shading',
};
const matKeysNotOverridden = ['Window', 'Door', 'Shading'];

const sttgsMat = {
    'byType': {},
    'byConst': {},
    'byConstDefault': {}
};
//? initialize byType
for (const [matType, matName] of Object.entries(matKeysbyType)) {
    let matSettingItem;
    if (matType == 'Override') {
        matSettingItem = sttgsOverrideMat.parentElement.parentElement;
    }
    else {
        matSettingItem = sttgsMatTemplatebyType.content.cloneNode(true);
        matSettingItem.querySelector('.settingsFlexSpan').dataset.tag = matType;
        matSettingItem.querySelector('.matTypeTag').innerHTML = `&nbsp;${matName}`;
    }

    const inputs = Object.fromEntries(
        Array.from(matSettingItem.querySelectorAll('.settingsInput'))
        .map((inputElement, idx) => {
            inputElement.name = `input${matType}${['Opacity', 'Color'][idx]}`;
            return [['opacity', 'color'][idx], inputElement];
        })
    );
    // apply default material settings
    const defaultMatSetting = DEFAULTS.matSettings.byType[matType];
    inputs.opacity.value = defaultMatSetting.opacity;
    inputs.opacity.placeholder = defaultMatSetting.opacity;
    inputs.color.value = defaultMatSetting.color;
    // add input children to object
    sttgsMat.byType[matType] = inputs;

    if (matType != 'Override') sttgsGroupMatbyType.appendChild(matSettingItem);
}

function resetMaterials(matBy) {
    let resetByType = false;
    let resetByConst = false;
    if (matBy == 'all') {
        resetByType = true;
        resetByConst = true;
    }
    else if (matBy == 'byType') resetByType = true;
    else if (matBy == 'byConst') resetByConst = true;
    else {
        console.error(`"${matBy}" is not a valid option for material show type!`);
        return;
    }

    //? byType
    if (resetByType) {
        for (const [matType, matInputs] of Object.entries(sttgsMat.byType)) {
            const defaultMatSetting = DEFAULTS.matSettings.byType[matType];
            matInputs.opacity.value = defaultMatSetting.opacity;
            matInputs.color.value = defaultMatSetting.color;
            const material = materials.byType[matType];
            material.opacity = defaultMatSetting.opacity;
            material.color = hexToRgb(defaultMatSetting.color);
            material.transparent = (defaultMatSetting.opacity < 1);
        }
    }
    //? byConst
    if (resetByConst) {
        for (const [tag, matInputs] of Object.entries(sttgsMat.byConstDefault)) {
            const template = matInputs.opacity.parentElement.dataset.template;
            const defaultMatSetting = DEFAULTS.matSettings.templates[template];
            matInputs.opacity.value = defaultMatSetting.opacity;
            matInputs.color.value = defaultMatSetting.color;
            const material = materials.byConstDefault[tag];
            material.opacity = defaultMatSetting.opacity;
            material.color = hexToRgb(defaultMatSetting.color);
            material.transparent = (defaultMatSetting.opacity < 1);
        }
        for (const [constName, matInputs] of Object.entries(sttgsMat.byConst)) {
            const template = matInputs.opacity.parentElement.dataset.template;
            const defaultMatSetting = DEFAULTS.matSettings.templates[template];
            matInputs.opacity.value = defaultMatSetting.opacity;
            matInputs.color.value = defaultMatSetting.color;
            const material = materials.byConst[constName];
            material.opacity = defaultMatSetting.opacity;
            material.color = hexToRgb(defaultMatSetting.color);
            material.transparent = (defaultMatSetting.opacity < 1);
        }
    }
    updateModel(force = true, source = 'resetMaterials');
}

function updateMatOpacity(e, inputfield) {
    const matBy = inputfield.parentElement.dataset.by;
    const matTag = inputfield.parentElement.dataset.tag;
    if (e === undefined || e.key === 'Escape') {
        inputfield.value = matSettings[matBy][matTag].opacity;
        inputfield.blur();
    }
    else if (e === true || e.key === 'Enter') {
        const inputOpacity = clamp(parseFloat(inputfield.value), 0, 1);
        inputfield.value = inputOpacity;
        matSettings[matBy][matTag].opacity = inputOpacity;
        materials[matBy][matTag].opacity = inputOpacity;
        materials[matBy][matTag].transparent = (inputOpacity < 1);
        inputfield.blur();
        updateModel(force = true, source = 'updateMatOpacity');
    }
}

function updateMatColor(inputElement) {
    const matBy = inputElement.parentElement.dataset.by;
    const matTag = inputElement.parentElement.dataset.tag;
    const inputColorHex = inputElement.value;
    matSettings[matBy][matTag].color = inputColorHex;
    materials[matBy][matTag].color = hexToRgb(inputColorHex);
    updateModel(force = true, source = 'updateMatColor');
}

function updateColorInputToggle(matBy) {
    let resetByType = false;
    let resetByConst = false;
    if (matBy == 'all') {
        resetByType = true;
        resetByConst = true;
    }
    else if (matBy == 'byType') resetByType = true;
    else if (matBy == 'byConst') resetByConst = true;
    else {
        console.error(`"${matBy}" is not a valid option for material show type!`);
        return;
    }

    //? byType
    if (resetByType) {
        for (const [matType, matInputs] of Object.entries(sttgsMat.byType)) {
            let [opacityOn, colorOn] = [true, true];
            if (overrideMatOn) {
                if (matType == 'Override') {
                    opacityOn = transparencyOn;
                    colorOn = true;
                }
                else {
                    if (matKeysNotOverridden.includes(matType)) {
                        opacityOn = true;
                        colorOn = true;
                    }
                    else {
                        opacityOn = false;
                        colorOn = false;
                    }
                }
            }
            else {
                if (matType == 'Override') {
                    opacityOn = false;
                    colorOn = false;
                }
                else {
                    if (matKeysNotOverridden.includes(matType)) opacityOn = true;
                    else opacityOn = transparencyOn;
                    colorOn = true;
                }
            }
            matInputs.opacity.disabled = !opacityOn;
            matInputs.color.disabled = !colorOn;
        }
    }
    //? byConst
    if (resetByConst) {
        sttgsMat.byConstDefault.DefaultOpaque.opacity.disabled = !transparencyOn;
        for (const [constName, matInputs] of Object.entries(sttgsMat.byConst)) {
            const enabled = matSettings.byConst[constName].enabled;
            let opacityOn = transparencyOn;
            let colorOn = enabled;

            const template = matInputs.opacity.parentElement.dataset.template;
            if (template == 'Transparent') opacityOn = true;
            if (!enabled) opacityOn = false;
            
            matInputs.opacity.disabled = !opacityOn;
            matInputs.color.disabled = !colorOn;
        }
    }
}

//? 투명도 설정
let transparencyOn = DEFAULTS.transparencyOn;
function turnOnTransparentMat(on) {
    transparencyOn = on;
    sttgsMatTrans.checked = on;
    updateColorInputToggle('all');
    updateModel(force = true, source = 'turnOnTransparentMat');
}

//MARK: Material by Type

//? 재질 오버라이드
let overrideMatOn = DEFAULTS.overrideMatOn;
function overrideMaterials(on) {
    overrideMatOn = on;
    sttgsOverrideMat.checked = on;
    updateColorInputToggle('byType');
    updateModel(force = true, source = 'overrideMaterials');
}

//MARK: Material by Const

const sttgsGroupMatbyConst = document.getElementById('SttgGroupMatbyConst');
const sttgsMatTemplatebyConst = document.getElementById('MatSettingsbyConst');
const sttgsMatTemplatebyConstSeparator = document.getElementById('MatSettingsbyConstSeparator');

//? initialize byConst Defaults
const sttgGroupMatbyConstDefault = document.getElementById('SttgGroupMatbyConstDefault');
for (const matSettingItem of Array.from(sttgGroupMatbyConstDefault.querySelectorAll('.settingsFlexSpan'))) {
    const tag = matSettingItem.dataset.tag;
    const inputs = Object.fromEntries(
        Array.from(matSettingItem.querySelectorAll('.settingsInput'))
        .map((inputElement, idx) => {
            inputElement.name = `inputMatByType${tag}${['Opacity', 'Color'][idx]}`;
            return [['opacity', 'color'][idx], inputElement];
        })
    );
    // apply default material settings
    const defaultMatSetting = DEFAULTS.matSettings.templates[matSettingItem.dataset.template];
    inputs.opacity.value = defaultMatSetting.opacity;
    inputs.opacity.placeholder = defaultMatSetting.opacity;
    inputs.color.value = defaultMatSetting.color;
    // add input children to object
    sttgsMat.byConstDefault[tag] = inputs;
    matSettings.byConstDefault[tag] = {...defaultMatSetting};
    materials.byConstDefault[tag] = new THREE.MeshPhongMaterial({
        ...defaultMatSetting,
        ...DEFAULTS.matSettings.common
    })
}

//? reset byConst
function resetMatByConst() {
    matSettings.byConst = {};
    materials.byConst = {};
    sttgsMat.byConst = {};
    sttgsGroupMatbyConst.innerHTML = '';
}

//? add color inputs
function addMatByConstSeparator() {
    const separator = sttgsMatTemplatebyConstSeparator.content.cloneNode(true);
    sttgsGroupMatbyConst.appendChild(separator);
}
function addMatByConst(constName, constNamePopup, opaque=true) {
    const matSettingItem = sttgsMatTemplatebyConst.content.cloneNode(true);
    const matSettingSpan = matSettingItem.querySelector('.settingsFlexSpan');
    matSettingSpan.dataset.tag = constName;
    matSettingSpan.dataset.template = opaque ? 'Opaque' : 'Transparent';
    
    const inputs = Object.fromEntries(
        Array.from(matSettingItem.querySelectorAll('input'))
        .map((inputElement, idx) => {
            inputElement.name = `inputMatByConst${constName}${['Checkbox', 'Opacity', 'Color'][idx]}`;
            return [['checkbox', 'opacity', 'color'][idx], inputElement];
        })
    );

    // connect label with checkbox
    const checkboxID = inputs.checkbox.name.replace(/[.#:\[\]>]/g, '-');
    inputs.checkbox.id = checkboxID;
    const constTag = matSettingItem.querySelector('.constTag');
    constTag.title = constNamePopup;
    constTag.innerHTML = `&nbsp;${constName}`;
    constTag.setAttribute('for', checkboxID);

    // apply default material settings
    inputs.checkbox.checked = false;
    const matSetting = matSettings.byConst[constName];
    inputs.opacity.value = matSetting.opacity;
    inputs.opacity.placeholder = matSetting.opacity;
    inputs.color.value = matSetting.color;

    // add input children to object
    sttgsMat.byConst[constName] = inputs;

    sttgsGroupMatbyConst.appendChild(matSettingItem);
}

//? update material by const toggle
function updateMatbyConstToggle(checkbox) {
    const constName = checkbox.parentElement.parentElement.dataset.tag;
    matSettings.byConst[constName].enabled = checkbox.checked;
    updateColorInputToggle('byConst');
    updateModel(force = true, source = 'updateMatEnabled');
}

function toggleMatByConstAll(visible) {
    for (const [constName, matInputs] of Object.entries(sttgsMat.byConst)) {
        matInputs.checkbox.checked = visible;
        matSettings.byConst[constName].enabled = visible;
    }
    updateColorInputToggle('byConst');
    updateModel(force = true, source = 'toggleMatByConstAll');
}
function updateColorInputByConstToggle() {}

/** 모델 불러올 때 설정 초기화 */
function resetSettings() {
    updateModelLock = true;
    turnOnShading(DEFAULTS.shadingOn);
    turnOnDebug(DEFAULTS.debugOn);
    turnOnLineThickness(DEFAULTS.lineThicknessOn);
    updateLineThickness(DEFAULTS.lineThickness);
    changeMaterialBy(DEFAULTS.materialBy);
    turnOnTransparentMat(DEFAULTS.transparencyOn);
    overrideMaterials(DEFAULTS.overrideMatOn);
    resetMaterials('all');
    changeVisFilter(DEFAULTS.visFilterType);
    selfShadow = DEFAULTS.selfShadow;
    shadowRadius = DEFAULTS.shadowRadius;
    shadowMapSize = DEFAULTS.shadowMapSize;
    shadowOffset = [...DEFAULTS.shadowOffset];  // 얕은 복사
    turnOnShadow(DEFAULTS.shadowOn);
    updateModelLock = false;
    updateModel(force = true, source = 'resetSettings');
}

let updateModelLock = false;
let lastModelUpdated = Date.now();
function updateModel(force = false, source = null) {
    //? if locked
    if (updateModelLock) return;
    //? throttle refresh rate
    let newTime = Date.now();
    if (force || (newTime - lastModelUpdated) / 1000 > REFRESHRATE) {
        lastModelUpdated = newTime;
        resetScene();
        renderModel();
        if (DEV) console.log(`model updated - ${source || '?'}, ${force}`)
    }
}

function updatePanels() {

    settingsPanelContent.scrollTo(0, 0);
    visibilityPanelContent.scrollTo(0, 0);

    // innerHTML = '<label><input type="checkbox" checked> Opacity</label>';
    //? Zone Visibility
    let innerHTML = '';
    for (const [zoneName, zoneProp] of Object.entries(zoneList)) {
        innerHTML += `<label><input type="checkbox" data-zone="${zoneName}" onclick="changeZoneVisibility(this);" checked> ${zoneName}</label>`;
    }

    //? Materials
    /*
    innerHTML += `
    <div class="settingsPanelBlock">
        <h5>Materials</h5>

        <center>Coming Soon</center>
    </div>
    `;
    */

    settingsPanelBlockZones.innerHTML = innerHTML;

}

//+ ------------------------------------------------------------------- +//
//MARK: Camera

function polarCoord(alt, azm) {
    let altR = Math.radians(alt);
    let azmR = Math.radians(- azm - 90);

    return new THREE.Vector3(Math.cos(altR) * Math.cos(azmR),
        Math.cos(altR) * Math.sin(azmR),
        Math.sin(altR));
}

let maxZoom = 950;
let lastRendered = Date.now();
function updateCamera(force = false, source = null) {
    // if (camera.alt > 90) camera.alt = 90;
    // if (camera.alt < -90) camera.alt = -90;
    camera.alt = clamp(camera.alt, -90, 90);

    // if (camera.radius < 1) camera.radius = 1;
    camera.radius = clamp(camera.radius, 1, maxZoom);
    if (lineThicknessOn) updateAbsoluteLineThickness();

    camera.azm %= 360;
    let displayAzm = camera.azm;
    if (camStepped) displayAzm = Math.round(camera.azm / 45) * 45;

    camera.position.copy(polarCoord(camera.alt, displayAzm).multiplyScalar(camera.radius).add(camera.base));
    camera.lookAt(camera.base);
    if (Math.abs(camera.alt) == 90) {
        camera.rotation.z = Math.radians(-Math.sign(camera.alt) * displayAzm);
    }

    lightDirect.position.copy(polarCoord(camera.alt, displayAzm + 45).add(camera.base));
    lightDirectTarget.position.copy(camera.base);
    lightShadow.position.copy(polarCoord(shadowOffset[0], displayAzm + shadowOffset[1]).multiplyScalar(camera.radius).add(bldgCenter));
    // lightShadow.position.copy(polarCoord(45, displayAzm+90).multiplyScalar(10).add(camera.base));
    // lightShadowTarget.position.copy(camera.base);

    objDev.position.copy(polarCoord(45, displayAzm + 90).multiplyScalar(10).add(camera.base));

    //? throttle refresh rate
    let newTime = Date.now();
    if (force || (newTime - lastRendered) / 1000 > REFRESHRATE) {
        lastRendered = newTime;
        renderer.render(scene, camera);
        if (DEV) console.log(`refreshed - ${source || '?'}, ${force}`)
    }
    //TODO labelRenderer.render(scene, camera);
}

//+ ------------------------------------------------------------------- +//
//MARK: Inputs

//? Key input
let clickable = false;
let mouseLeft = false;
let mouseMiddle = false;
let shiftKey = false;
let camStepped = false;  // 카메라 45도 간격
let camFixed = false;
let commandOn = false;

let startX = null;
let startY = null;

let pressedKeys = {};
// window.onkeyup = function(e) { pressedKeys[e.keyCode] = false; }
// window.onkeydown = function(e) { pressedKeys[e.keyCode] = true; }

//? Mouse input
CanvasContainer.ondragstart = function () {
    return false;
}
function customOnMouseMove(event) {
    let newX = event.pageX;
    let newY = event.pageY;
    let dX = newX - startX;
    let dY = newY - startY;

    if (mouseLeft) {
        camera.azm += dX / panelWidth * 180;
        // camera.alt = clamp(camera.alt + dY / panelHeight * 180, -90, 90);
        camera.alt += dY / panelHeight * 180;
        // console.log(camera.azm, camera.alt);
        // console.log(camera.position, camera.rotation);
    }
    else if (mouseMiddle) {
        let altR = Math.radians(camera.alt);
        // let azmR = Math.radians(-camera.azm-90-90);
        let azmR = -Math.radians(camera.azm + 180);
        // let multX = dX/panelWidth*10;
        // let multY = dY/panelHeight*10;
        let multX = dX / panelWidth * camera.radius / 2;
        let multY = dY / panelWidth * camera.radius / 2;
        let offsetVec = new THREE.Vector3(
            Math.cos(azmR) * multX + Math.sin(altR) * Math.sin(azmR) * multY,
            Math.sin(azmR) * multX - Math.sin(altR) * Math.cos(azmR) * multY,
            Math.cos(altR) * multY,
        );
        camera.base.add(offsetVec);
    }
    updateCamera(force = false, source = 'customOnMouseMove');
    startX = newX;
    startY = newY;
}
CanvasRenderer.onmousedown = function (event) {
    // event.preventDefault();

    startX = event.pageX;
    startY = event.pageY;

    if (event.button == 0) {
        // 좌클릭
        mouseLeft = true;
        mouseMiddle = false;
    }
    if (event.button == 1 || event.button == 2) {
        // 가운데 클릭
        mouseMiddle = true;
        mouseLeft = false;
    }

    document.addEventListener('mousemove', customOnMouseMove);
    document.onmouseup = function (event) {
        // event = event || window.event;
        // event.preventDefault();
        mouseLeft = false;
        mouseMiddle = false;
        if (camStepped) camera.azm = Math.round(camera.azm / 45) * 45;
        document.removeEventListener('mousemove', customOnMouseMove);
    }
    // else {
    //     settingsPanelVisibility();
    // }
}
document.addEventListener('onmouseleave', function () {
    document.removeEventListener('mousemove', customOnMouseMove);
})
// CanvasContainer.onmouseup = function(event) {
//     event = event || window.event;
//     CanvasContainer.removeEventListener('mousemove', customOnMouseMove);
// }
CanvasContainer.onwheel = function (event) {
    if (clickable) {
        camera.radius -= event.wheelDeltaY / 100 * clamp((camera.radius / 50) ** 1.2, 1, Infinity);
        // camera.zoom = event.wheelDeltaY / 210;
        updateCamera(force = true, source = 'onwheel');
    }
}
document.getElementById('PageWrapper').onwheel = function (event) {
    event = event || window.event;  //! deprecated?
    if (event.target.id == 'CanvasRenderer' && clickable) {
        return false;
    }
}
document.getElementById('PageWrapper').onmousedown = function (event) {
    event = event || window.event;  //! deprecated?
    if ((event.button == 1 || event.button == 2) && event.target.id == 'CanvasRenderer') {
        return false;
    }
}

//? Keyboard
document.onkeydown = function (event) {
    const key = event.key.toLowerCase();
    const code = event.code;
    // if (key == '/' || commandOn) event.preventDefault();  //TODO
    if (key == '/') event.preventDefault();
    if (event.shiftKey) shiftKey = true;
    if (mouseLeft && event.shiftKey) {
        camStepped = true;
        updateCamera(force = true, source = 'onkeydown');
    }
    if (!commandOn && event.target.tagName.toLowerCase() != 'input') {
        if (idfName !== '' && code == 'KeyS') {
            exportImage();
        }
        if (code == 'KeyR') {
            centerCamera();
        }
        if (idfName !== '' && event.ctrlKey && event.shiftKey && (code == 'KeyC' || code == 'KeyV')) {
            event.preventDefault();
            if (code == 'KeyC') {
                panelVisibility(copyPanel, 1);
            }
            if (code == 'KeyV') {
                loadSettings();
            }
        }
    }
}
const nonCommandKey = new Array('Shift', 'Alt', 'Control', 'Enter', 'Escape', 'Tab', 'CapsLock', 'ContextMenu');
document.onkeyup = function (event) {
    // for command
    // console.log(event.key, nonCommandKey.includes(event.key))
    // (!nonCommandKey.includes(event.key))

    // various actions
    switch (event.key) {
        case 'Shift':
            shiftKey = false;
            camStepped = false;
            updateCamera(force = true, source = 'onkeyup(shift)');
            break;
        case '/':
            if (!commandOn) {
                // 명령창 띄우기
                commandListenerVisibility(1);
            }
            break;
        case 'Enter':
            if (copyPanel.style.visibility == 'visible') {
                copySettings();
            }
            break;
        case 'Escape':
            // panelVisibility(commandPanel, -1);
            if (commandOn) {
                commandListenerVisibility(0);
            }
            else {
                panelVisibilityAll(-1);
                // if (idfName == '') settingsPanelVisibility(-1);
                // else settingsPanelVisibility(0);
            }
            break;
    }
}


/*
// scrollTop = window.pageYOffset || document.documentElement.scrollTop;
// scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
// window.onscroll = function () {
//     window.scrollTo(scrollLeft, scrollTop);
// }
function preventScroll (e) {
    // e.preventDefault();
    // e.stopPropagation();

    // return false;
    window.scrollTo(0, 0)
}
function disablePageScroll () {
    // document.querySelector('.scrollable').addEventListener('wheel', preventScroll);
    window.addEventListener('wheel', preventScroll);
    window.addEventListener('scroll', preventScroll);
}
function enablePageScroll () {
    // document.querySelector('.scrollable').removeEventListener('wheel', preventScroll);
    window.removeEventListener('wheel', preventScroll);
    window.removeEventListener('scroll', preventScroll);
}
disablePageScroll();
window.onscroll() = function () {
    return false;
}
*/

//+ ------------------------------------------------------------------- +//
//MARK: Object Selection

const raycaster = new THREE.Raycaster();
raycaster.layers.set(1);
const pointer = new THREE.Vector2();
const objectDisplay = document.getElementById('objectDisplay');
let lastHighlightedObj = null;
let lastHighlightedObjMat = null;
const matHighlighted = new THREE.MeshPhongMaterial({ color: '#ff0000', side: THREE.DoubleSide, opacity: 0.7, transparent: true });
let highlightedObjDisplayText = '';
let lastSelectedObj = null;
let lastSelectedObjMat = null;
const matSelected = new THREE.MeshPhongMaterial({ color: '#ff0000', side: THREE.DoubleSide, opacity: 0.8, transparent: true });
let selectedObjDisplayText = '';

function objectHighlight(event) {
    if (mouseLeft || mouseMiddle) return;
    // calculate pointer position in normalized device coordinates
    const rect = event.target.getBoundingClientRect();
    const x = event.pageX - rect.left;
    const y = event.pageY - rect.top;
    // (-1 to +1) for both components
    const offsetX = clamp(x / mainPanelWidth, 0, 1) * 2 - 1;
    const offsetY = -clamp(y / mainPanelHeight, 0, 1) * 2 + 1;
    pointer.x = offsetX;
    pointer.y = offsetY;

    // update the picking ray with the camera and pointer position
    raycaster.setFromCamera(pointer, camera);

    // if (lastHighlightedObj) {
    //     lastHighlightedObj.material = lastHighlightedObjMat;
    //     if (lastSelectedObj) {
    //         lastSelectedObj.material = matSelected;
    //     }
    //     updateCamera(force=true);
    // }

    // calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(scene.children);
    let newHighlightedObj = intersects.length > 0 ? intersects[0].object : null;

    if (newHighlightedObj === lastHighlightedObj) {
        return;
    }
    else {
        if (lastHighlightedObj) {
            lastHighlightedObj.material = lastHighlightedObjMat;
            if (lastSelectedObj) {
                lastSelectedObj.material = matSelected;
            }
        }
    }

    if (intersects.length == 0) {
        objectDisplay.innerHTML = '';
        lastHighlightedObj = null;
    }
    else if (lastHighlightedObj !== intersects[0].object) {
        let obj = intersects[0].object;
        // obj.material.color.set(0xff0000);
        lastHighlightedObj = obj;
        lastHighlightedObjMat = obj.material.clone();
        // obj.material.color.set(0xff0000);
        obj.material = matHighlighted;

        let objName = obj.sourceObjName;
        let objType = obj.sourceObjType;
        let objProp = {};

        let displayText = '<b>[Name]</b> ' + objName;
        switch (objType) {
            case 'surface':
                objProp = surfList[objName];
                if (objProp.OutsideBCObj !== undefined && objProp.OutsideBCObj != '') {
                    displayText += ` (${objProp.OutsideBCObj.toLowerCase()})`;
                }
                displayText += `<br><b>[Type]</b> ${objType} (${objProp.SurfaceType})`;
                displayText += '<br><b>[Construction]</b> ' + objProp.Construction;
                displayText += '<br><b>[Zone]</b> ' + objProp.ZoneName;
                displayText += '<br>  └─<b>[Surface]</b> ' + objName;
                break;
            case 'fenestration':
                objProp = fenList[objName];
                if (objProp.OutsideBCObj !== undefined && objProp.OutsideBCObj != '') {
                    displayText += ` (${objProp.OutsideBCObj.toLowerCase()})`;
                }
                displayText += `<br><b>[Type]</b> ${objType} (${objProp.SurfaceType})`;
                displayText += '<br><b>[Construction]</b> ' + objProp.Construction;
                displayText += '<br><b>[Zone]</b> ' + surfList[objProp.SurfaceName].ZoneName;
                displayText += '<br>  └─<b>[Surface]</b> ' + objProp.SurfaceName;
                displayText += '<br>     └─<b>[Fenestration]</b> ' + objName;
                break;
            case 'shading':
                objProp = shadeList[objName];
                displayText += '<br><b>[Type]</b> ' + objType;
                break;
        }
        displayText = displayText.replaceAll(' ', '&nbsp;')
        objectDisplay.innerHTML = displayText;
        highlightedObjDisplayText = displayText;

    }

    updateCamera(force = true, source = 'objectHighlight');
}
// CanvasContainer.addEventListener('pointermove', objectHighlight);
CanvasRenderer.addEventListener('pointerleave', function () {
    if (lastHighlightedObj !== null) {
        lastHighlightedObj.material = lastHighlightedObjMat;
        updateCamera(force = true, source = 'pointerleave');
    }
    objectDisplay.innerHTML = '';
})

// function objSelectionPointerDown(event) {
//     CanvasRenderer.addEventListener('pointermove', objSelectionPointerMove);
//     CanvasRenderer.addEventListener('pointerup', objSelectionPointerUp);
// }
// function objSelectionPointerMove(event) {
//     CanvasRenderer.removeEventListener('pointermove', objectHighlight);
//     lastHighlightedObj.material = lastHighlightedObjMat;
//     lastHighlightedObj = null;
//     lastHighlightedObjMat = null;
// }
// function objSelectionPointerUp(event) {
//     CanvasRenderer.addEventListener('pointermove', objectHighlight);
//     CanvasRenderer.removeEventListener('pointermove', objSelectionPointerMove);
//     // console.log
//     if (lastHighlightedObj !== null) {
//         lastHighlightedObj.material = lastHighlightedObjMat;
//         if (lastSelectedObj !== null) {
//             lastSelectedObj.material = lastSelectedObjMat;
//         }
//         lastSelectedObj = lastHighlightedObj;
//         lastSelectedObjMat = lastSelectedObj.material.clone();
//         lastSelectedObj.material = matSelected;
//         updateCamera();
//     }
//     else {
//         lastSelectedObj.material = lastSelectedObjMat;
//         lastSelectedObj = null;
//     }
//     CanvasRenderer.removeEventListener('pointerup', objSelectionPointerUp);
// }

//+ ------------------------------------------------------------------- +//
//MARK: Reset Settings

function resetBldgInfo() {
    readSuccess = false;
    northAxis = 0;
    boundary = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
    bldgRadius = 0;
    bldgCenter = new THREE.Vector3();
    zoneList = {};
    surfList = {};
    fenList = {};
    shadeList = {};
    sceneObjects = Object.fromEntries(DEFAULTS.sceneObjectKeys.map(k => [k, []]));
    shadowCatcher = null;
    resetMatByConst();
}

function resetCamera() {
    // 카메라 초기화
    camera.base = new THREE.Vector3(0, 0, 0);
    camera.alt = 20;
    camera.azm = -30;  // 0 = south
    camera.radius = 10;
    updateCamera(force = true, source = 'resetCamera');
}
resetCamera();

function centerCamera() {
    // 모델에 맞게 카메라 위치 설정
    resetCamera();
    camera.base.copy(bldgCenter);
    camera.radius = bldgRadius * 1.5;
    updateCamera(force = true, source = 'centerCamera');
}

function resetScene() {
    scene.remove.apply(scene, scene.children);
    sceneObjects = Object.fromEntries(DEFAULTS.sceneObjectKeys.map(k => [k, []]));

    scene.add(lightDirect);
    scene.add(lightDirectTarget);
    lightDirect.target = lightDirectTarget;
    scene.add(lightAmbient);
    scene.add(lightShadow);
    scene.add(lightShadowTarget);
    lightShadow.target = lightShadowTarget;
    // scene.add(new THREE.CameraHelper(lightShadow.shadow.camera));
    // scene.add(new THREE.DirectionalLightHelper(lightShadow));

    if (DEV) scene.add(objDev);
}
resetScene();


//+ ------------------------------------------------------------------- +//
//MARK: Triangulate Surface

//? 수평한 점 리스트로부터 triangulate된 리스트 생성
function triangulateSurfacefromFlatVertlist(vertList, holes = null) {
    let vertTriangulated = [];
    earcut(vertList.flat(), holes, 3).forEach(vIdx => {
        vertTriangulated.push(vertList[vIdx]);
    });
    return vertTriangulated
}

//? 점 리스트로부터 triangulate된 서피스 생성
function triangulatedSurfacefromVertlist(vertList, holes = null) {

    const unitX = new THREE.Vector3(1, 0, 0);
    const unitZ = new THREE.Vector3(0, 0, 1);

    //? 면의 법선 벡터 계산
    // (첫 번째 점 -> 두 번째 점) 벡터와 (첫 번째 점 -> n 번째 점) 벡터의 cross product 계산 (법선 벡터)
    let surf_normvec = new THREE.Vector3();  // surface의 법선 벡터
    let vert1 = new THREE.Vector3(...vertList[0]);
    let vert2 = new THREE.Vector3(...vertList[1]);
    let vec1 = new THREE.Vector3().subVectors(vert2, vert1);
    for (let i = 2; i < vertList.length; i++) {
        let vert3 = new THREE.Vector3(...vertList[i]);
        let vec2 = new THREE.Vector3().subVectors(vert3, vert1);
        surf_normvec = new THREE.Vector3().crossVectors(vec2, vec1);
        if (surf_normvec.length() > THRESHOLD) {
            // 두 벡터가 일직선이 아님
            break;
        }
    }

    //? 서피스 생성
    let surfGeom = new THREE.BufferGeometry();

    surf_normvec.normalize();
    if (new THREE.Vector3().crossVectors(surf_normvec, unitZ).length() < THRESHOLD) {
        // 이미 수평일 때
        let vertSurf = new Float32Array(
            triangulateSurfacefromFlatVertlist(
                vertList,
                holes
            ).flat()
        );
        surfGeom.setAttribute('position', new THREE.BufferAttribute(vertSurf, 3));
    }
    else {
        // 수평이 아닐 때
        let quaternion = new THREE.Quaternion();  // 평면을 회전시킬 quaternion
        quaternion.setFromUnitVectors(surf_normvec, unitZ);

        let vertListHor = [];
        vertList.forEach(v => {
            let vec = new THREE.Vector3(...v);
            vec.applyQuaternion(quaternion);
            vertListHor.push([vec.x, vec.y, vec.z]);
        });
        let vertSurf = new Float32Array(
            triangulateSurfacefromFlatVertlist(
                vertListHor,
                holes
            ).flat()
        );
        surfGeom.setAttribute('position', new THREE.BufferAttribute(vertSurf, 3));
        quaternion.invert();  // 회전을 반대 방향으로
        surfGeom.applyQuaternion(quaternion);
    }

    surfGeom.computeVertexNormals();

    return surfGeom;
}

//+ ------------------------------------------------------------------- +//
//MARK: Load IDF File

function loadExampleFile() {
    idfName = exampleIDFName;
    idfExt = exampleIDFExt;
    loadFile(exampleIDFCode);
}
window.onload = loadExampleFile;

function readFile(fileList) {
    if (fileList.length > 0) {
        const idfFile = fileList[0];
        if (idfFile.name.endsWith('.idf')) {
            idfName = idfFile.name.slice(0, -4);
            idfExt = '.idf';
        }
        else if (idfFile.name.endsWith('.expidf')) {
            idfName = idfFile.name.slice(0, -7);
            idfExt = '.expidf';
        }
        else {
            window.alert('Only .idf, .expidf formats supported!');
            return;
        }
        reader.readAsText(idfFile, "utf-8");
    }
}

function loadFile(code) {
    CanvasRenderer.removeEventListener('pointermove', objectHighlight);
    // CanvasRenderer.removeEventListener('pointerdown', objSelectionPointerDown);
    settingsPanelVisibility(0);
    panelVisibilityAll(-1);
    if (!camFixed) {
        resetSettings();
    }
    lastHighlightedObj = null;  // highlighted objects
    lastHighlightedObjMat = null;  // highlighted objects
    resetBldgInfo();
    parseIDF(code);
    hoverBtnVisibility(0);
    fileSelectorTag.innerHTML = (idfName == '') ? '' : idfName + idfExt;
    addModel();
    updatePanels();
    // 높이 슬라이더 업데이트
    updateSliderRange(boundary[0][2], boundary[1][2], heightSliderGroup);
    CanvasRenderer.addEventListener('pointermove', objectHighlight);
    // CanvasRenderer.addEventListener('pointerdown', objSelectionPointerDown);
}

const reader = new FileReader();
reader.onload = function () { loadFile(reader.result) };

const fileSelector = document.getElementById('fileSelector');
const fileSelectorTag = document.getElementById('fileSelectorTag');
fileSelector.addEventListener('change', (event) => {
    const fileList = event.target.files;
    readFile(fileList);
});

document.body.addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();
    clickable = true;
    fileHoverMask.style.display = 'none';
    fileHover.style.display = 'none';

    const fileList = e.dataTransfer.files;
    readFile(fileList);
});
const fileHoverMask = document.getElementById('fileHoverMask');  // drag&drop 받기 위한 object
const fileHover = document.getElementById('fileHover');  // drag&drop 설명 object
const fileHoverText = document.getElementById('fileHoverText');  // drag&drop 설명 text
document.body.addEventListener('dragover', function (e) {
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    clickable = false;
    fileHoverMask.style.display = 'block';
    fileHover.style.display = 'block';
    if (e.shiftKey) {
        camFixed = true;
        fileHoverText.style.textShadow = '#fff 0 0 10px, #ffe880 0 0 20px, #000 0 0 30px';
    }
    else {
        camFixed = false;
        fileHoverText.style.textShadow = '#fff 0 0 10px, #80daff 0 0 20px, #000 0 0 30px';
    }
});
fileHoverMask.addEventListener('dragleave', function (e) {
    // console.log(e.target)
    camFixed = false;
    clickable = true;
    fileHoverMask.style.display = 'none';
    fileHover.style.display = 'none';
});

//+ ------------------------------------------------------------------- +//
//MARK: Parse IDF File

function parseIDF(code) {

    if (code.length <= 0) return -1;

    //? 주석 제거
    code = code.replace(/!.*\s*/g, '');
    //? 공백 제거
    code = code.replace(/,\s*/g, ',').replace(/;\s*/g, ';').trim();
    //? 오브젝트별로 분리
    const objectList = code.split(';');

    //? 버전 검사
    iddInfoLibrary = null;
    let versionCode = '';
    for (let i = 0; i < objectList.length; i++) {
        let obj = objectList[i];
        if (obj.toLowerCase().startsWith('Version'.toLowerCase())) {
            let version = obj.split(',')[1].split('.');
            let v = [parseInt(version[0]), parseInt(version[1])]
            versionCode = v[0] + '_' + v[1] + '_0';
            if (!(versionCode in versionLibrary)) {
                if (v[0] <= 7) {
                    versionCode = '7_2_0';
                }
                else {
                    versionCode = Object.keys(versionLibrary)[Object.keys(versionLibrary).length - 1];
                }
            }
            console.log(versionCode + '.idd used.');
            break;
        }
    }
    iddInfoLibrary = versionLibrary[versionCode];
    // console.log(iddInfoLibrary);

    //? North Axis 검사
    for (let i = 0; i < objectList.length; i++) {
        let obj = objectList[i];
        if (obj.toLowerCase().startsWith('Building'.toLowerCase())) {
            northAxis = parseFloat(obj.split(',')[2]);
            break;
        }
    }

    //? Zone, Construction 관련
    objectList.forEach(obj => {
        if (!obj.toLowerCase().startsWith('Zone'.toLowerCase())
            && !obj.toLowerCase().startsWith('Construction'.toLowerCase())) {
            return;
        }
        let objSplit = obj.split(',');
        let objName = objSplit[1];

        switch (objSplit[0].toLowerCase()) {
            case 'Zone'.toLowerCase():
                let iddInfo = iddInfoLibrary['Zone'.toLowerCase()];

                if (!(objName in zoneList)) {
                    zoneList[objName] = {
                        'Surfaces': [],
                        'Origin': [Number(objSplit[iddInfo.indexOf('x origin')]),
                        Number(objSplit[iddInfo.indexOf('y origin')]),
                        Number(objSplit[iddInfo.indexOf('z origin')])],
                        'NDirection': [],  //TODO zone 원점과 방향이 다를 때 반영
                        'Visible': true,
                        'ZBoundary': [Infinity, -Infinity]
                    };
                }
                break;
        }
    });
    let zoneNamesLowercase = Object.keys(zoneList).map(v => v.toLowerCase());  // surface쪽 zone 이름과 대소문자가 다른 경우 교정하기 위한 임시 리스트

    let alerted = false;  // wall, window 사용 시 알림 띄웠는지 여부
    objectList.forEach(obj => {
        //? Wall, Window로 정의되어 있는지 검사
        if (obj.toLowerCase().startsWith('Wall,'.toLowerCase())
            || obj.toLowerCase().startsWith('Wall:'.toLowerCase())
            || obj.toLowerCase().startsWith('Window,'.toLowerCase())
            || obj.toLowerCase().startsWith('Window:'.toLowerCase())) {
            if (!alerted) {
                alerted = true;
                idfName = '';
                settingsPanelVisibility(-1);
                window.alert('Currently only supports idf files using "BuildingSurface:Detailed".');
            }
            return;
        }

        //? Surface, FenSurf, Shading 관련
        if (!obj.toLowerCase().startsWith('BuildingSurface:Detailed'.toLowerCase())
            && !obj.toLowerCase().startsWith('FenestrationSurface:Detailed'.toLowerCase())
            && !obj.toLowerCase().startsWith('Shading:Building:Detailed'.toLowerCase())) {
            return;
        }
        let objSplit = obj.split(',');
        let objName = objSplit[1].toLowerCase();

        switch (objSplit[0].toLowerCase()) {

            //? Surface
            case 'BuildingSurface:Detailed'.toLowerCase(): {
                let iddInfo = iddInfoLibrary['BuildingSurface:Detailed'.toLowerCase()];

                let zoneName = objSplit[iddInfo.indexOf('zone name')];
                let zoneNameIndex = zoneNamesLowercase.indexOf(zoneName.toLowerCase());  // 대소문자가 다른 경우
                zoneName = Object.keys(zoneList)[zoneNameIndex];
                let zoneCoord = zoneList[zoneName].Origin;

                // var vertNum = objSplit[10];  // 점 개수
                let vCoordStart = iddInfo.indexOf('vertex 1 x-coordinate');
                let vertNum = parseInt((objSplit.length - vCoordStart) / 3);  // 점 개수
                let surfVertices = [];  // 점 좌표 리스트
                let minZ = Infinity;  // 가장 작은 z값 (shadow object 생성 시 필요)
                let maxZ = -Infinity;  // 가장 큰 z값 (shadow object 생성 시 필요)
                for (let v = 0; v < vertNum; v++) {
                    let vCoord = [];  // 점 하나 좌표
                    for (let axis = 0; axis < 3; axis++) {
                        let coordRelative = Number(objSplit[vCoordStart + v * 3 + axis]);  // 현재 좌푯값
                        let coord = zoneCoord[axis] + coordRelative;  // zone 기준점 반영한 좌푯값
                        // boundary 양쪽 끝 점 업데이트
                        if (coord < boundary[0][axis]) boundary[0][axis] = coord;
                        if (coord > boundary[1][axis]) boundary[1][axis] = coord;

                        vCoord.push(coord)  // 좌푯값 추가

                        if (axis == 2 && coord < minZ) minZ = coord;
                        if (axis == 2 && maxZ < coord) maxZ = coord;
                    }
                    surfVertices.push(vCoord);
                    // surfVertices.push(new THREE.Vector3(vCoord[0], vCoord[1], vCoord[2]));
                }
                let fens = [];
                if (objName in surfList) fens = surfList[objName].Fenestrations;

                surfList[objName] = {
                    'SurfaceType': objSplit[iddInfo.indexOf('surface type')].toLowerCase(),
                    'Construction': objSplit[iddInfo.indexOf('construction name')],
                    'ZoneName': zoneName,
                    'OutsideBC': objSplit[iddInfo.indexOf('outside boundary condition')].toLowerCase(),
                    'OutsideBCObj': objSplit[iddInfo.indexOf('outside boundary condition object')],
                    'VerticeNumber': vertNum,
                    'Vertices': surfVertices,
                    'Fenestrations': fens,
                    'ZBoundary': [minZ, maxZ]
                }

                zoneList[zoneName].Surfaces.push(objName);
                if (minZ < zoneList[zoneName].ZBoundary[0]) {
                    zoneList[zoneName].ZBoundary[0] = minZ;
                }
                if (zoneList[zoneName].ZBoundary[1] < maxZ) {
                    zoneList[zoneName].ZBoundary[1] = maxZ;
                }

                break;
            }

            //? FenestrationSurface
            case 'FenestrationSurface:Detailed'.toLowerCase(): {
                let iddInfo = iddInfoLibrary['FenestrationSurface:Detailed'.toLowerCase()];

                let surfName = objSplit[iddInfo.indexOf('building surface name')].toLowerCase();
                let zoneName = surfList[surfName].ZoneName;
                let zoneCoord = zoneList[zoneName].Origin;

                // var vertNum = objSplit[9];  // 점 개수
                let vCoordStart = iddInfo.indexOf('vertex 1 x-coordinate');
                let vertNum = parseInt((objSplit.length - vCoordStart) / 3);  // 점 개수
                let surfVertices = [];  // 점 좌표 리스트
                for (let v = 0; v < vertNum; v++) {
                    let vCoord = [];  // 점 하나 좌표
                    for (let axis = 0; axis < 3; axis++) {
                        let coordRelative = Number(objSplit[vCoordStart + v * 3 + axis]);  // 현재 좌푯값
                        let coord = zoneCoord[axis] + coordRelative;  // zone 기준점 반영한 좌푯값
                        // boundary 양쪽 끝 점 업데이트
                        if (coord < boundary[0][axis]) boundary[0][axis] = coord;
                        if (coord > boundary[1][axis]) boundary[1][axis] = coord;

                        vCoord.push(coord)  // 좌푯값 추가
                    }
                    surfVertices.push(vCoord);
                    // surfVertices.push(new THREE.Vector3(vCoord[0], vCoord[1], vCoord[2]));
                }
                fenList[objName] = {
                    'SurfaceType': objSplit[iddInfo.indexOf('surface type')].toLowerCase(),
                    'Construction': objSplit[iddInfo.indexOf('construction name')],
                    'SurfaceName': surfName,
                    'OutsideBCObj': objSplit[iddInfo.indexOf('outside boundary condition object')],
                    'VerticeNumber': vertNum,
                    'Vertices': surfVertices,
                }

                if (surfName in surfList) {
                    surfList[surfName].Fenestrations.push(objName);
                }
                else {
                    surfList[surfName] = {
                        // 'SurfaceType'  : undefined,
                        // 'Construction' : undefined,
                        // 'ZoneName'     : undefined,
                        // 'VerticeNumber': undefined,
                        // 'Vertices'     : undefined,
                        'Fenestrations': [objName],
                    }
                }
                break;
            }

            //? Shading
            case 'Shading:Building:Detailed'.toLowerCase(): {
                let iddInfo = iddInfoLibrary['Shading:Building:Detailed'.toLowerCase()];

                let vCoordStart = iddInfo.indexOf('vertex 1 x-coordinate');
                let vertNum = parseInt((objSplit.length - vCoordStart) / 3);  // 점 개수
                let surfVertices = [];  // 점 좌표 리스트
                let minZ = Infinity;  // 가장 작은 z값 (shadow object 생성 시 필요)
                let maxZ = -Infinity;  // 가장 큰 z값 (shadow object 생성 시 필요)
                for (let v = 0; v < vertNum; v++) {
                    let vCoord = [];  // 점 하나 좌표
                    for (let axis = 0; axis < 3; axis++) {
                        let coord = Number(objSplit[vCoordStart + v * 3 + axis]);  // 현재 좌푯값
                        // boundary 양쪽 끝 점 업데이트
                        /*
                        ? shading은 boundary 산정에서 제외
                        if (coord < boundary[0][axis]) boundary[0][axis] = coord;
                        if (coord > boundary[1][axis]) boundary[1][axis] = coord;
                        */

                        vCoord.push(coord)  // 좌푯값 추가

                        if (axis == 2 && coord < minZ) minZ = coord;
                        if (axis == 2 && maxZ < coord) maxZ = coord;
                    }
                    surfVertices.push(vCoord);
                    // surfVertices.push(new THREE.Vector3(vCoord[0], vCoord[1], vCoord[2]));
                }
                shadeList[objName] = {
                    'VerticeNumber': vertNum,
                    'Vertices': surfVertices,
                    'ZBoundary': [minZ, maxZ]
                }

                break;
            }
            default: {
                break;
            }
        }
    });

    //? 건물 boundary 및 중심 업데이트
    let center = [];
    let radius = 0;
    for (let axis = 0; axis < 3; axis++) {
        center.push((boundary[0][axis] + boundary[1][axis]) / 2);
        radius += Math.pow(boundary[1][axis] - boundary[0][axis], 2);
    }
    bldgRadius = Math.sqrt(radius);
    bldgCenter = new THREE.Vector3(...center);
    lightShadowTarget.position.copy(bldgCenter);

    //? 중복되는 면 제거
    // surfNameSet = new Set(Object.keys(surfList));
    // for (const [surfName, surfProp] of Object.entries(surfList)) {
    //     if (
    //         surfProp.OutsideBC != 'outdoors'
    //         && surfProp.OutsideBC != 'grounds'
    //         && surfProp.SurfaceType != 'roof'
    //         && surfNameSet.has(surfProp.OutsideBCObj)
    //     ) {
    //         delete surfList[surfName];
    //         surfNameSet.delete(surfName);
    //     }
    // }

    //? 재질 업데이트
    
    //? Surfaces
    addMatByConstSeparator();
    const surfToSkip = [];
    for (const [surfName, surfProp] of Object.entries(surfList)) {
        if (surfName in surfToSkip) continue;

        const constName = surfProp.Construction;

        if (constName in materials.byConst) continue;

        let [constNameToUse, constNameNotUsed] = ['', ''];
        let constNamePopup = '';
        if (surfProp.OutsideBC == 'surface') {
            // if there is adjacent surface
            const adjSurfName = surfProp.OutsideBCObj;
            surfToSkip.push(adjSurfName);
            const adjConstName = surfList[adjSurfName.toLowerCase()].Construction;
            if (constName.toLowerCase() == adjConstName.toLowerCase()) {
                constNameToUse = constName;
                constNamePopup = constName;
            }
            else {
                // constName에 reversed가 들어있지 않는 한 constName을 대표로 사용
                [constNameToUse, constNameNotUsed]
                    = constName.toLowerCase().includes('reverse') ?
                        [adjConstName, constName] : [constName, adjConstName];
                constNamePopup = `${constNameToUse} / ${constNameNotUsed}`;
            }
        }
        else {
            constNameToUse = constName;
            constNamePopup = constName;
        }

        const matSetting = {...DEFAULTS.matSettings.templates.Opaque, enabled: false};
        matSettings.byConst[constNameToUse] = matSetting;

        materials.byConst[constNameToUse] = new THREE.MeshPhongMaterial({
            color: matSetting.color,
            opacity: matSetting.opacity,
            ...DEFAULTS.matSettings.common
        })
        if (matSetting.opacity == 1) materials.byConst[constNameToUse].transparent = false;
        if (constNameNotUsed != '') {
            // add as a reference
            matSettings.byConst[constNameNotUsed] = matSettings.byConst[constNameToUse];
            materials.byConst[constNameNotUsed] = materials.byConst[constNameToUse];
        }
        
        // add color inputs
        addMatByConst(constNameToUse, constNamePopup);
    }

    //? Fenestrations
    addMatByConstSeparator();
    const fenToSkip = [];
    for (const [fenName, fenProp] of Object.entries(fenList)) {
        if (fenName in fenToSkip) continue;

        const constName = fenProp.Construction;

        if (constName in materials.byConst) continue;

        let [constNameToUse, constNameNotUsed] = ['', ''];
        let constNamePopup = '';
        if (surfList[fenProp.SurfaceName].OutsideBC == 'surface') {
            // if there is adjacent surface
            const adjFenName = fenProp.OutsideBCObj;
            fenToSkip.push(adjFenName);
            const adjConstName = fenList[adjFenName.toLowerCase()].Construction;
            if (constName.toLowerCase() == adjConstName.toLowerCase()) {
                constNameToUse = constName;
                constNamePopup = constName;
            }
            else {
                // constName에 reversed가 들어있지 않는 한 constName을 대표로 사용
                [constNameToUse, constNameNotUsed]
                    = constName.toLowerCase().includes('reverse') ?
                        [adjConstName, constName] : [constName, adjConstName];
                constNamePopup = `${constNameToUse} / ${constNameNotUsed}`;
            }
        }
        else {
            constNameToUse = constName;
            constNamePopup = constName;
        }

        const matSetting = {...DEFAULTS.matSettings.templates.Transparent, enabled: false};
        matSettings.byConst[constNameToUse] = matSetting;

        materials.byConst[constNameToUse] = new THREE.MeshPhongMaterial({
            color: matSetting.color,
            opacity: matSetting.opacity,
            ...DEFAULTS.matSettings.common
        })
        if (matSetting.opacity == 1) materials.byConst[constNameToUse].transparent = false;
        if (constNameNotUsed != '')
            materials.byConst[constNameNotUsed] = materials.byConst[constNameToUse];  // add as a reference
        
        // add color inputs
        addMatByConst(constNameToUse, constNamePopup, false);
    }

    updateColorInputToggle('all');

    // console.log(surfList);
    // console.log(fenList);
    console.log("Done!");
    readSuccess = Object.keys(zoneList).length > 0;

    // if (scheduleLines.length < 2) return -1;
}

//+ ------------------------------------------------------------------- +//
//MARK: Render Model

function addModel() {
    resetScene();

    if (!camFixed) {
        centerCamera();
    }

    //? ShadowCatcher 생성
    // minZ = boundary[0][2] - 0.01;
    let minZ = - 0.01;
    let shadCatPadX = boundary[1][0] - boundary[0][0];
    let shadCatPadY = boundary[1][1] - boundary[0][1];
    let shadCatPad = Math.max(shadCatPadX, shadCatPadY);

    let shadowCatcherGeom = new THREE.BufferGeometry();
    let shadowCatcherVerts = new Float32Array([
        boundary[0][0] - shadCatPadX, boundary[0][1] - shadCatPadY, minZ,
        boundary[1][0] + shadCatPadX, boundary[0][1] - shadCatPadY, minZ,
        boundary[1][0] + shadCatPadX, boundary[1][1] + shadCatPadY, minZ,
        boundary[0][0] - shadCatPadX, boundary[0][1] - shadCatPadY, minZ,
        boundary[1][0] + shadCatPadX, boundary[1][1] + shadCatPadY, minZ,
        boundary[0][0] - shadCatPadX, boundary[1][1] + shadCatPadY, minZ,
    ]);
    shadowCatcherGeom.setAttribute('position', new THREE.BufferAttribute(shadowCatcherVerts, 3));
    shadowCatcherGeom.computeVertexNormals();
    shadowCatcher = new THREE.Mesh(shadowCatcherGeom, shadowCatcherMat);
    shadowCatcher.receiveShadow = true;
    // shadowCatcher.renderOrder = Infinity;
    shadowCatcher.renderOrder = 2;
    // shadowCatcher.translateZ(boundary[0][2]);
    shadowCatcher.position.z = 0;  //TODO UI상에서 옵션 추가

    // Shadow 조명 범위 설정
    lightShadow.shadow.camera = new THREE.OrthographicCamera(-shadCatPad, shadCatPad, shadCatPad, -shadCatPad, 0.5, 1000);

    //? axis object 생성
    let axisOffset = new THREE.Vector3(boundary[0][0] - bldgRadius * 0.1, boundary[0][1] - bldgRadius * 0.1, 0);
    axisXObject = axisXObjTemplate.clone();
    axisXObject.translateX(axisOffset.x); axisXObject.translateY(axisOffset.y);
    axisYObject = axisYObjTemplate.clone();
    axisYObject.translateX(axisOffset.x); axisYObject.translateY(axisOffset.y);
    axisZObject = axisZObjTemplate.clone();
    axisZObject.translateX(axisOffset.x); axisZObject.translateY(axisOffset.y);
    axisTrueNorthObject = axisTrueNorthObjTemplate.clone();
    axisTrueNorthObject.translateX(axisOffset.x); axisTrueNorthObject.translateY(axisOffset.y);
    axisTrueNorthObject.rotateZ(Math.radians(northAxis));

    //? Surface(Fenestration 제외) 테두리 및 면 생성
    for (const [surfName, surfProp] of Object.entries(surfList)) {

        //? Surface 면 생성
        let vertList = surfProp.Vertices;
        let holes = null;
        if (surfProp.Fenestrations.length > 0) {
            // 만약 surface에 창문이 있다면, 구멍을 추가
            holes = [];
            surfProp.Fenestrations.forEach(fenName => {
                let fen = fenList[fenName];
                holes.push(vertList.length);
                vertList = vertList.concat(fen.Vertices);
            });
        }

        const surfGeom = triangulatedSurfacefromVertlist(vertList, holes);
        surfList[surfName].Geometries = surfGeom;

        //? Surface 테두리 생성
        let points = [];
        let positions = [];
        surfProp.Vertices.forEach(v => {
            points.push(new THREE.Vector3(v[0], v[1], v[2]));
            positions.push(...v);
        });
        points.push(points[0]);
        positions.push(positions[0], positions[1], positions[2]);
        //? line으로 그릴 때
        let edgeGeom = new THREE.BufferGeometry().setFromPoints(points);
        surfList[surfName].EdgeObjects = new THREE.Line(edgeGeom, matEdge);
        //? pipe로 그릴 때
        let edgeGeom2 = new LineGeometry();
        edgeGeom2.setPositions(positions);
        surfList[surfName].EdgeObjects2 = new Line2(edgeGeom2, matEdge2);
        surfList[surfName].EdgeObjects2.renderOrder = 0;

        //? Surface 그림자 생성용 geometry 생성
        /*
        if (surfList[surfName].MaximumZ > boundary[0][2]) {}  // shadow catcher와 겹치지 않을 경우
        else surfList[surfName].ShadowObjects = null;
        */
        let surfShadGeom = triangulatedSurfacefromVertlist(surfProp.Vertices);
        let surfShadObj = new THREE.Mesh(surfShadGeom, matGhost);
        surfShadObj.castShadow = true;
        surfShadObj.material.colorWrite = false;
        // surfShadObj.material.transparent = true; // only needed if there are other transparent objects
        surfShadObj.renderOrder = Infinity;
        surfList[surfName].ShadowObjects = surfShadObj;
    }
    //? Fenestration 테두리 및 면 생성
    for (const [fenName, fenProp] of Object.entries(fenList)) {

        //? Fenestration 면 생성
        const fenGeom = triangulatedSurfacefromVertlist(fenProp.Vertices);
        fenGeom.computeVertexNormals();

        fenList[fenName].Geometries = fenGeom;

        //? Fenestration 테두리 생성
        let points = [];
        let positions = [];
        fenProp.Vertices.forEach(v => {
            points.push(new THREE.Vector3(v[0], v[1], v[2]));
            positions.push(...v);
        });
        points.push(points[0]);
        positions.push(positions[0], positions[1], positions[2]);
        //? line으로 그릴 때
        let edgeGeom = new THREE.BufferGeometry().setFromPoints(points);
        fenList[fenName].EdgeObjects = new THREE.Line(edgeGeom, matEdge);
        //? pipe로 그릴 때
        let edgeGeom2 = new LineGeometry();
        edgeGeom2.setPositions(positions);
        fenList[fenName].EdgeObjects2 = new Line2(edgeGeom2, matEdge2);
        fenList[fenName].EdgeObjects2.renderOrder = 0;
    }
    //? Shading 테두리 및 면 생성
    for (const [shadeName, shadeProp] of Object.entries(shadeList)) {

        //? Shading 면 생성
        const shadeGeom = triangulatedSurfacefromVertlist(shadeProp.Vertices);
        shadeGeom.computeVertexNormals();

        shadeList[shadeName].Geometries = shadeGeom;

        //? Shading 테두리 생성
        let points = [];
        shadeProp.Vertices.forEach(v => {
            points.push(new THREE.Vector3(v[0], v[1], v[2]));
        });
        points.push(points[0]);
        //? line으로 그릴 때
        let edgeGeom = new THREE.BufferGeometry().setFromPoints(points);
        shadeList[shadeName].EdgeObjects = new THREE.Line(edgeGeom, matEdge);
        //? pipe로 그릴 때
        // var edgeGeom = 

        let shadeShadGeom = triangulatedSurfacefromVertlist(shadeProp.Vertices);
        let shadoeShadObj = new THREE.Mesh(shadeShadGeom, matGhost);
        shadoeShadObj.castShadow = true;
        shadoeShadObj.material.colorWrite = false;
        // surfShadObj.material.transparent = true; // only needed if there are other transparent objects
        shadoeShadObj.renderOrder = Infinity;
        shadeList[shadeName].ShadowObjects = shadoeShadObj;
    }

    renderModel();
}

function renderModel() {

    //TODO 저장된 테두리 모델 불러와서 렌더링

    // 그림자 받을 평면
    if (shadowOn) {
        // var shadowCatcher = new THREE.Mesh(shadowCatcherGeom, new THREE.MeshPhongMaterial({color: '#f24b91'}));
        scene.add(shadowCatcher);

        /*
        const geometry = new THREE.SphereGeometry( 3, 32, 16 );
        const sphere = new THREE.Mesh( geometry, matDev ); scene.add( sphere );
        sphere.translateZ(3);
        sphere.castShadow = true;
        */
    }

    // Surface 렌더링
    let surfToSkip = [];
    for (const [surfName, surfProp] of Object.entries(surfList)) {

        // 인접한 서피스가 이미 그려진 경우 통과
        if (surfToSkip.includes(surfName)) continue;

        // 서피스가 속한 존 이름
        let zoneName = surfProp.ZoneName;
        // if (!isZoneVisible(zoneName)) continue;

        let surfGeom = surfProp.Geometries;  // 면 geometry 불러옴

        // 면 재질 설정
        let matSurf;
        if (materialBy == 'byType') {
            matSurf = materials.byType.InnerSurf;
            if (overrideMatOn) matSurf = materials.byType.Override;
            else {
                switch (surfProp.OutsideBC) {
                    case 'outdoors':

                        switch (surfProp.SurfaceType) {
                            case 'wall':
                                matSurf = materials.byType.OuterWall;
                                break;
                            case 'roof':
                                matSurf = materials.byType.Roof;
                                break;
                            case 'floor':
                                //!!!!! Need evaluation
                                matSurf = materials.byType.OuterSurf;
                                break;
                        }

                        break;

                    case 'adiabatic':
                        matSurf = materials.byType.Adiabatic;
                        break;

                    case 'ground':
                        matSurf = materials.byType.Ground;
                        break;

                    default:
                        break;
                }
                if (surfName.toLowerCase() == surfProp.OutsideBCObj.toLowerCase()) {
                    matSurf = materials.byType.Adiabatic;
                }
            }
        }
        else if (materialBy == 'byConst') {
            const constName = surfProp.Construction;
            if (matSettings.byConst[constName].enabled) {
                matSurf = materials.byConst[constName];
            }
            else {
                matSurf = materials.byConstDefault.DefaultOpaque;
            }
        }
        /*
        if (surfName.startsWith('front_pv')) {
            matSurf = new THREE.MeshLambertMaterial({color: '#163aba', side: THREE.DoubleSide})
        }
        if (surfName.endsWith('iues3') || surfName.endsWith('iues4')) {
            matSurf = new THREE.MeshLambertMaterial({color: '#8f8f8f', side: THREE.DoubleSide})
        }
        */
        matSurf = matSurf.clone();

        //TODO 경계조건 zone일 때 서피스 생성
        if (surfProp.OutsideBC == 'surface' && surfProp.OutsideBCObj != '') {
            let adjSurf = surfProp.OutsideBCObj.toLowerCase();
            let adjZone = surfList[adjSurf].ZoneName;
            if (isZoneVisible(zoneName)) {
                surfToSkip.push(adjSurf);
            }
            else if (isZoneVisible(adjZone)) {
                surfToSkip.push(surfName);
                continue;
            }
            else {
                surfToSkip.push(adjSurf);
            }
        }

        if (isZoneVisible(zoneName)) {
            if (!transparencyOn) {
                if (matSurf.opacity < 1) {
                    // matSurf.color = add_black_color_rgb(matSurf.color, matSurf.opacity);
                    /*
                    matSurf.color = add_white_color_rgb(
                        add_black_color_hex(matSurf.color, matSurf.opacity),
                        1 - (1 - matSurf.opacity) / 2.5
                    );
                    */
                    matSurf.opacity = 1;
                }
                matSurf.transparent = false;
                //* matSurf.depthWrite = true;
            }
            const surfMesh = new THREE.Mesh(surfGeom, matSurf);
            /*
            # TEST FOR SURFACE VECTOR
            console.log('test');
            normVec = new THREE.Vector3(...surfGeom.attributes.normal.array.slice(0, 3));
            surfMesh.translateOnAxis(normVec, 0.1);
            */
            surfMesh.renderOrder = 1;
            surfMesh.layers.enable(1);  // for mouse selection
            surfMesh.sourceObjName = surfName;
            surfMesh.sourceObjType = 'surface';
            if (selfShadow) surfMesh.receiveShadow = true;  // 자체 그림자

            scene.add(surfMesh);  //!!!!!
            sceneObjects.surfMesh.push(surfMesh);

            /*
            TODO
            surfMesh.layers.enableAll();
            const earthDiv = document.createElement('div');
            earthDiv.className = 'label';
            earthDiv.textContent = 'Earth';
            earthDiv.style.backgroundColor = 'transparent';
            const earthLabel = new CSS2DObject(earthDiv);
            earthLabel.position.set(0, 0, 0 );
            // earthLabel.center.set(0, 0);
            earthLabel.layers.set(0);
            surfMesh.add(earthLabel);
            */

            //? EdgeObjects
            // if (surfProp.SurfaceType != 'roof' && surfProp.SurfaceType != 'floor' && surfProp.SurfaceType != 'ceiling') {
            //     scene.add(surfProp.EdgeObjects);
            // }
            if (lineThicknessOn) { scene.add(surfProp.EdgeObjects2); }
            // if (lineThicknessOn && ['outdoors', 'ground'].includes(surfProp.OutsideBC)) {
            //     scene.add(surfProp.EdgeObjects2);
            // }
            else { scene.add(surfProp.EdgeObjects); }

            if (shadowOn && surfProp.ShadowObjects != null) scene.add(surfProp.ShadowObjects);
        }
        else {
            switch (hiddenMatType) {
                case 'disable':
                    break;

                case 'wireframe':
                    scene.add(surfProp.EdgeObjects);
                    break;

                case 'ghost':
                    const surfMesh = new THREE.Mesh(surfGeom, DEFAULTS.matTemplates.Disabled);
                    surfMesh.renderOrder = 3;
                    surfMesh.layers.enable(2);  // disable mouse selection
                    scene.add(surfMesh);  //!!!!!
                    break;

                default:
                    break;
            }
        }
    }

    // Fenestration 렌더링 
    let fenToSkip = [];
    for (const [fenName, fenProp] of Object.entries(fenList)) {

        if (fenToSkip.includes(fenName)) {
            continue;
        }

        let surfProp = surfList[fenProp.SurfaceName];
        let zoneName = surfProp.ZoneName;
        if (!isZoneVisible(zoneName)) {
            if (hiddenMatType == 'wireframe') {
                scene.add(fenProp.EdgeObjects);
            }
            continue;
        }

        if (fenProp.OutsideBCObj != '') {
            fenToSkip.push(fenProp.OutsideBCObj.toLowerCase());
        }

        let fenGeom = fenProp.Geometries;

        let matFen;
        if (materialBy == 'byType') {
            matFen = materials.byType.Window;
            switch (fenProp.SurfaceType) {
                case 'door':
                    matFen = materials.byType.Door;
                    break;
                case 'glassdoor':
                    matFen = materials.byType.Door;
                    break;
            }
        }
        else if (materialBy == 'byConst') {
            const constName = fenProp.Construction;
            if (matSettings.byConst[constName].enabled) {
                matFen = materials.byConst[constName];
            }
            else {
                matFen = materials.byConstDefault.DefaultTransparent;
            }
        }

        matFen = matFen.clone();
        /*matFen.color = add_white_color_rgb(
            add_black_color_hex(matFen.color, clamp(1 + 0.3 - matFen.opacity, 0, 1)),
            1 - clamp(matFen.opacity - 0.3, 0, 1) / 2.5
        );*/
        /*
        if (!transparencyOn) {
            if (matFen.opacity < 1) {
                // matFen.color = add_black_color_rgb(matFen.color, matFen.opacity);
                // matFen.color = add_white_color_rgb(matFen.color, matFen.opacity);
                matFen.color = add_white_color_rgb(
                    add_black_color_hex(matFen.color, matFen.opacity),
                    1-(1-matFen.opacity)/2.2
                );
                matFen.opacity = 1;
            }
            matFen.transparent = false;
            //* matFen.depthWrite = true;
        }
        */
        const fenMesh = new THREE.Mesh(fenGeom, matFen);
        fenMesh.renderOrder = 1;
        fenMesh.layers.enable(1);  // for mouse selection
        fenMesh.sourceObjName = fenName;
        fenMesh.sourceObjType = 'fenestration';

        scene.add(fenMesh);  //!!!!!

        //? EdgeObjects
        if (lineThicknessOn && ['outdoors', 'ground'].includes(surfProp.OutsideBC)) {
            scene.add(fenProp.EdgeObjects2);
        }
        else { scene.add(fenProp.EdgeObjects); }
    }

    // Shading 렌더링
    for (const [shadeName, shadeProp] of Object.entries(shadeList)) {

        let shadeGeom = shadeProp.Geometries;

        let matShade;
        if (materialBy == 'byType') {
            matShade = materials.byType.Shading.clone();
        }
        else if (materialBy == 'byConst') {
            matShade = materials.byConstDefault.Shading;
        }
        
        matShade = matShade.clone();
        if (shadingOn && isInsideHeightRange(shadeProp.ZBoundary)) {
            if (!transparencyOn) {
                if (matShade.opacity < 1) {
                    // matShade.color = add_black_color_rgb(matShade.color, matShade.opacity);
                    // matShade.color = add_white_color_rgb(matShade.color, matShade.opacity);
                    /*
                    matShade.color = add_white_color_rgb(
                        add_black_color_hex(matShade.color, matShade.opacity),
                        1 - (1 - matShade.opacity) / 2.2
                    );
                    */
                    matShade.opacity = 1;
                }
                matShade.transparent = false;
                //* matShade.depthWrite = true;
            }
            const shadeMesh = new THREE.Mesh(shadeGeom, matShade);
            shadeMesh.layers.enable(1);  // for mouse selection
            shadeMesh.sourceObjName = shadeName;
            shadeMesh.sourceObjType = 'shading';
            // shadeMesh.castShadow = true;

            scene.add(shadeMesh);  //!!!!!
            scene.add(shadeProp.EdgeObjects);

            if (shadowOn) scene.add(shadeProp.ShadowObjects);
        }
        else {
            switch (hiddenMatType) {
                case 'disable':
                    break;

                case 'wireframe':
                    scene.add(shadeProp.EdgeObjects);
                    break;

                case 'ghost':
                    const shadeMesh = new THREE.Mesh(shadeGeom, DEFAULTS.matTemplates.Disabled);
                    shadeMesh.renderOrder = 3;
                    shadeMesh.layers.enable(2);  // disable mouse selection
                    scene.add(shadeMesh);  //!!!!!
                    break;

                default:
                    break;
            }
        }
    }

    if (debugOn) {
        scene.add(axisXObject);
        scene.add(axisYObject);
        scene.add(axisZObject);
        scene.add(axisTrueNorthObject);
    }

    // scene.add(new THREE.CameraHelper(lightShadow.shadow.camera));

    updateCamera(force = true, source = 'renderModel');
}

/*
TODO
축척
방위 표시
선 굵기
*/

//+ ------------------------------------------------------------------- +//
//MARK: Background Color

function changeBackgroundColor(color = -1, eventBtn = null) {
    Array.from(document.querySelectorAll('#SettingsPanelBlockBackground .changeBackgroundColorBtn')).forEach((btn) => {
        btn.classList.remove('changeBgColorBtnHighlighted');
        btn.disabled = false;
    });
    eventBtn.classList.add('changeBgColorBtnHighlighted');
    eventBtn.disabled = true;
    switch (color) {
        case -1:
            // transparent
            CanvasContainer.style.backgroundColor = '';
            objectDisplay.className = 'transparentmode';
            console.log('Background changed to "transparent"');
            break;
        case 0:
            // black
            CanvasContainer.style.backgroundColor = 'black';
            objectDisplay.className = 'blackmode';
            console.log('Background changed to "black"');
            break;
        case 1:
            //white
            CanvasContainer.style.backgroundColor = 'white';
            objectDisplay.className = 'whitemode';
            console.log('Background changed to "white"');
            break;
    }
}

//+ ------------------------------------------------------------------- +//
//MARK: Visibility

let visFilterType = DEFAULTS.visFilterType;

const visByZones = document.getElementById('VisByZones');
const visByHeight = document.getElementById('VisByHeight');

function changeVisFilter(type) {
    Array.from(document.querySelectorAll('#SettingsPanelBlockVisFilter .changeBackgroundColorBtn')).forEach((btn) => {
        if (btn.dataset.type == type) {
            btn.classList.add('changeBgColorBtnHighlighted');
            btn.disabled = true;
        }
        else {
            btn.classList.remove('changeBgColorBtnHighlighted');
            btn.disabled = false;
        }
    });

    visFilterType = type;

    switch (type) {
        case 'zones':
            visByZones.style.display = 'block';
            visByHeight.style.display = 'none';
            break;

        case 'height':
            visByZones.style.display = 'none';
            visByHeight.style.display = 'block';
            break;

        case 'both':
            visByZones.style.display = 'none';
            visByHeight.style.display = 'none';
            break;

        default:
            break;
    }

    updateModel(force = true, source = 'changeVisFilter');
}

function isZoneVisible(zoneName) {
    const zoneObject = zoneList[zoneName];
    switch (visFilterType) {
        case 'zones':
            return zoneObject.Visible;
            break;
        case 'height':
            return isInsideHeightRange(zoneObject.ZBoundary);
            break;
        case 'both':
            return zoneObject.Visible & isInsideHeightRange(zoneObject.ZBoundary);
            break;
        default:
            return false;
            break;
    }
}
function isInsideHeightRange(boundary) {
    if (visFilterType == 'zones') return true;
    const [sliderMinZ, sliderMaxZ] = getSliderValues(heightSliderGroup);
    return (boundary[0] <= sliderMaxZ) && (sliderMinZ <= boundary[1]);
}

//? Zone 토글
function changeZoneAll(visible) {
    for (const [zoneName, zoneProp] of Object.entries(zoneList)) {
        zoneProp.Visible = visible;
    }
    for (const chkbox of settingsPanelBlockZones.querySelectorAll('input[type=checkbox]')) {
        chkbox.checked = visible;
    }
    updateModel(force = true, source = 'changeZoneAll');
}
function changeZoneVisibility(zoneCheckbox) {
    zoneList[zoneCheckbox.dataset.zone].Visible = zoneCheckbox.checked;
    updateModel(force = true, source = 'changeZoneVisibility');
}

//? Height 조절
const fromSlider = document.querySelector('#fromSlider');
const toSlider = document.querySelector('#toSlider');
const fromInput = document.querySelector('#fromInput');
const toInput = document.querySelector('#toInput');
const sliderBackground = document.querySelector('#SliderBackground');
const heightSliderGroup = [fromSlider, toSlider, fromInput, toInput, 0, sliderBackground];  // 숫자는 두 슬라이더 사이 최소 거리
resetSliderValue();

fromSlider.oninput = () => updateFromValue(fromSlider.value, heightSliderGroup);
fromSlider.onmouseup = () => updateModel(force = true, source = 'fromSliderMouseUp');
toSlider.oninput = () => updateToValue(toSlider.value, heightSliderGroup);
toSlider.onmouseup = () => updateModel(force = true, source = 'toSliderMouseUp');
// fromInput.oninput = () => updateFromValue(fromInput.value, heightSliderGroup, true);
fromInput.addEventListener('keydown', (event) => updateSliderInput(event, fromInput, true));
// toInput.oninput = () => updateToValue(toInput.value, heightSliderGroup, true);
toInput.addEventListener('keydown', (event) => updateSliderInput(event, toInput, false));

fromInput.addEventListener('focusout', () => { fromInput.value = getSliderValues(heightSliderGroup)[0]; });
toInput.addEventListener('focusout', () => { toInput.value = getSliderValues(heightSliderGroup)[1]; });


function resetSliderValue() {
    updateSliderValue(parseFloat(heightSliderGroup[0].min), parseFloat(heightSliderGroup[0].max), heightSliderGroup);
}
function updateSliderRange(lb, ub, sliderGroup) {
    lb = roundFloat(lb, 2);
    ub = roundFloat(ub, 2);
    sliderGroup[0].min = lb;
    sliderGroup[0].max = ub;
    sliderGroup[1].min = lb;
    sliderGroup[1].max = ub;
    resetSliderValue();
}
function getSliderRange(sliderGroup) {
    return [
        parseFloat(sliderGroup[0].min),
        parseFloat(sliderGroup[0].max)
    ];
}
function getSliderValues(sliderGroup) {
    return [
        parseFloat(sliderGroup[0].value),
        parseFloat(sliderGroup[1].value)
    ];
}
function updateSliderInput(event, inputfield, from) {
    if (event.key === 'Enter') {
        event.preventDefault();
        if (from)
            updateFromValue(inputfield.value, heightSliderGroup);
        else
            updateToValue(inputfield.value, heightSliderGroup);
    }
    if (event.key === 'Escape') {
        inputfield.value = getSliderValues(heightSliderGroup)[from ? 0 : 1];
    }
}
function updateFromValue(fromVal, sliderGroup, forceUpdate = false) {
    let from = parseFloat(fromVal);
    if (isNaN(from)) return;
    let to = parseFloat(sliderGroup[1].value);
    if (from > to - sliderGroup[4]) {
        from = to - sliderGroup[4];
    }
    updateSliderValue(from, to, sliderGroup, forceUpdate);
}
function updateToValue(toVal, sliderGroup, forceUpdate = false) {
    let to = parseFloat(toVal);
    if (isNaN(to)) return;
    let from = parseFloat(sliderGroup[0].value);
    if (to < from + sliderGroup[4]) {
        to = from + sliderGroup[4];
    }
    updateSliderValue(from, to, sliderGroup, forceUpdate);
}
function updateSliderValue(from, to, sliderGroup, forceUpdate = false) {
    from = roundFloat(from, 2);
    to = roundFloat(to, 2);
    sliderGroup[0].value = from;
    sliderGroup[1].value = to;
    sliderGroup[2].value = from;
    sliderGroup[3].value = to;
    sliderGroup[0].style.zIndex = 1;
    if (to == parseFloat(sliderGroup[0].min)) {
        sliderGroup[1].style.zIndex = 2;
    }
    else {
        sliderGroup[1].style.zIndex = '';
    }
    const [sliderMin, sliderMax] = getSliderRange(heightSliderGroup);
    const rangeDistance = sliderMax - sliderMin;
    const fromPosition = from - sliderMin;
    const toPosition = to - sliderMin;
    fillSlider(fromPosition / rangeDistance, toPosition / rangeDistance, sliderGroup[5]);
    updateModel(force = forceUpdate, source = 'updateSliderValue');
}
function fillSlider(fromNormalized, toNormalized, sliderBackground) {
    const sliderColor = '#112C4460';
    const rangeColor = '#112C44';
    sliderBackground.style.background = `linear-gradient(
        to right,
        ${sliderColor} 0%,
        ${sliderColor} ${fromNormalized * 100}%,
        ${rangeColor} ${fromNormalized * 100}%,
        ${rangeColor} ${toNormalized * 100}%, 
        ${sliderColor} ${toNormalized * 100}%, 
        ${sliderColor} 100%)`;
}

//+ ------------------------------------------------------------------- +//
//MARK: Commands

const commandListener = document.getElementById('CommandListener');
commandListenerVisibility(0);

function commandListenerVisibility(toggle = 0) {
    switch (toggle) {
        case 0:
            // 닫을 때
            commandOn = false;
            commandListener.style.visibility = 'hidden';
            commandListener.style.opacity = 0;
            commandListener.classList.remove('fadein');
            commandListener.classList.add('fadeout');
            break;
        case 1:
            // 열 때
            commandOn = true;
            commandListener.value = '';
            commandListener.style.visibility = 'visible';
            commandListener.style.opacity = 1;
            commandListener.classList.remove('fadeout');
            commandListener.classList.add('fadein');
            commandListener.classList.remove('CommandFail');
            commandListener.classList.remove('CommandSuccess');
            commandListener.focus();
    }
}

let lastCommand = ''

function runCommandInput(event) {
    if (!event.metaKey) {
        if (event.key == 'ArrowUp' && lastCommand != '') {
            commandListener.value = lastCommand;
        }
    }
    if (event.key === 'Enter') {
        commandListenerVisibility(0);
        console.log(commandListener.value)
        runCommand(commandListener.value);
    }
}

function runCommand(command = '') {
    command = command.toLowerCase();
    lastCommand = command;
    commandListener.classList.add('CommandSuccess');
    switch (command) {
        //? 키워드 하나만 있는 명령어
        case 'test':
            console.log('TEST!');
            break;
        case 'help':
            panelVisibility(commandPanel, 1);
            hoverBtnVisibility(-1);
            break;
        //? 키워드 + 값 형태의 명령어
        default:
            if (!command.includes(' ')) {
                commandFail();
                return;
            }
            let log = command.match(/(\S+)\s+(\S+)/);
            let commandName = log[1];
            let commandVal = log[2];
            lastCommand = commandName + ' ';
            switch (commandName) {
                case 'test':
                    console.log('TEST! -', commandVal);
                    break;
                //? Camera
                case 'camerafar':
                    commandVal = parseFloat(commandVal);
                    if (isNaN(commandVal)) {
                        commandFail();
                        return;
                    }
                    if (commandVal < 1000) commandVal = 1000;
                    camera.far = commandVal;
                    camera.updateProjectionMatrix();
                    updateCamera(force = true, source = 'runCommand');
                    break;
                case 'maxzoom':
                    commandVal = parseFloat(commandVal);
                    if (isNaN(commandVal)) {
                        commandFail();
                        return;
                    }
                    if (commandVal < 950) commandVal = 950;
                    maxZoom = commandVal;
                    camera.far = commandVal + 50;
                    camera.updateProjectionMatrix();
                    updateCamera(force = true, source = 'runCommand');
                    break;
                case 'camerafov':
                    commandVal = parseFloat(commandVal);
                    if (isNaN(commandVal)) {
                        commandFail();
                        return;
                    }
                    commandVal = clamp(commandVal, 10, 170);
                    camera.fov = commandVal;
                    camera.updateProjectionMatrix();
                    updateCamera(force = true, source = 'runCommand');
                    break;
                case 'animatecamera':
                    totalFrames = parseInt(commandVal);
                    if (isNaN(totalFrames)) {
                        commandFail();
                        return;
                    }
                    direction = commandVal.match(/[a-z]+$/);
                    if (direction == 'cw') {
                        clockwise = true;
                    }
                    else if (direction == 'ccw') {
                        clockwise = false;
                    }
                    else {
                        commandFail();
                        return;
                    }
                    animateFrame(totalFrames, animateCameraHorizontal, clockwise);
                    break;
                case 'animateheight':
                    totalFrames = parseInt(commandVal);
                    if (isNaN(totalFrames)) {
                        commandFail();
                        return;
                    }
                    direction = commandVal.match(/[a-z]+$/);
                    if (direction == 'up') {
                        bottomToTop = true;
                    }
                    else if (direction == 'dn') {
                        bottomToTop = false;
                    }
                    else {
                        commandFail();
                        return;
                    }
                    animateFrame(totalFrames, animateVisibleHeight, bottomToTop);
                    break;
                //? Model
                //? Shadows
                case 'shadowalt':
                    commandVal = parseFloat(commandVal);
                    if (isNaN(commandVal)) {
                        commandFail();
                        return;
                    }
                    shadowOffset[0] = commandVal;
                    updateCamera(force = true, source = 'runCommand');
                    break;
                case 'shadowazm':
                    commandVal = parseFloat(commandVal);
                    if (isNaN(commandVal)) {
                        commandFail();
                        return;
                    }
                    shadowOffset[1] = commandVal;
                    updateCamera(force = true, source = 'runCommand');
                    break;
                case 'shadowmapsize':
                    shadowMapSize = parseInt(commandVal);
                    if (isNaN(shadowMapSize)) {
                        commandFail();
                        return;
                    }
                    if (shadowOn) updateShadowProperties();
                    updateCamera(force = true, source = 'runCommand');
                    break;
                case 'shadowradius':
                    shadowRadius = parseFloat(commandVal);
                    if (isNaN(shadowRadius)) {
                        commandFail();
                        return;
                    }
                    if (shadowOn) updateShadowProperties();
                    updateCamera(force = true, source = 'runCommand');
                    break;
                case 'shadowheight':
                    commandVal = parseFloat(commandVal);
                    if (isNaN(commandVal)) {
                        commandFail();
                        return;
                    }
                    shadowCatcher.translateZ(commandVal - shadowCatcher.position.z);
                    updateCamera(force = true, source = 'runCommand');
                    break;
                case 'selfshadow':
                    selfShadow = commandVal == 'on';
                    updateShadowProperties();
                    break;
                default:
                    commandFail();
                    return;
            }
            break;
    }
}
function commandFail() {
    lastCommand = '';
    commandListener.classList.remove('CommandSuccess');
    commandListener.classList.add('CommandFail');
}

//+ ------------------------------------------------------------------- +//
//MARK: Copy & Paste Settings

function toggleCopyCheckboxes(block, select) {
    for (const label of block.querySelectorAll('label')) {
        label.querySelector('input').checked = select;
    }
}

function settingsCode(tag, code = undefined) {
    switch (tag) {
        //? Zone visibility filter type
        case 'zv':
            if (code) {
                // load setting
                if (code.includes('/')) {
                    changeVisFilter('height');
                    const boundary = code.split('/').map(Number);
                    updateSliderValue(...boundary, heightSliderGroup, true);
                }
                else {
                    changeVisFilter('zones');
                }
            }
            else {
                // copy setting
                switch (visFilterType) {
                    case 'height':
                        const boundary = getSliderValues(heightSliderGroup);
                        return `${boundary[0]}/${boundary[1]}`;
                        break;
                    default:
                        return '0';
                        break;
                }
            }
            break;
        //? Shading visibility
        case 'sh':
            if (code) {
                // load setting
                turnOnShading(code == '1');
            }
            else {
                // copy setting
                return shadingOn ? '1' : '0';
            }
            break;
        //? Material transparency
        case 'mt':
            if (code) {
                // load setting
                turnOnTransparentMat(code == '1');
            }
            else {
                // copy setting
                return transparencyOn ? '1' : '0';
            }
            break;
        //? Override materials
        case 'om':
            if (code) {
                // load setting
                overrideMaterials(code == '1');
            }
            else {
                // copy setting
                return overrideMatOn ? '1' : '0';
            }
            break;
        //? Window opacity
        case 'wo':
            if (code) {
                // load setting
                updateWindowOpacity(parseFloat(code));
            }
            else {
                // copy setting
                return String(windowOpacity);
            }
            break;
        //? Edge thickness
        case 'et':
            if (code) {
                // load setting
                // ex. -0.1 -> -:두께 비활성화, 0.1:두께 0.1
                const thk = parseFloat(code);
                turnOnLineThickness(thk > 0);
                updateLineThickness(Math.abs(thk));
            }
            else {
                // copy setting
                return String(lineThickness * (lineThicknessOn ? 1 : -1));
            }
            break;
        //? Hidden objects material
        case 'hm':
            if (code) {
                // load setting
                // 0: disabled, 1: wireframe, 2: ghost
                const matType = hiddenMatTypeOptions[parseInt(code)];
                changeHiddenMatType(matType);
            }
            else {
                // copy setting
                return String(hiddenMatTypeOptions.indexOf(hiddenMatType));
            }
            break;
        //? Shadow toggle
        case 'st':
            if (code) {
                // load setting
                turnOnShadow(code == '1');
            }
            else {
                // copy setting
                return shadowOn ? '1' : '0';
            }
            break;
        //? Shadow settings
        case 'ss':
            if (code) {
                // load setting
                const ss = code.split('/');
                shadowOffset[0] = parseFloat(ss[0]);  // shadowalt
                shadowOffset[1] = parseFloat(ss[1]);  // shadowazm
                shadowMapSize = parseInt(ss[2]);  // shadowmapsize
                shadowRadius = parseFloat(ss[3]);  // shadowradius
                shadowCatcher.translateZ(parseFloat(ss[4]) - shadowCatcher.position.z);  // shadowheight
                selfShadow = (ss[5] == '1');
                updateShadowProperties();
            }
            else {
                // copy setting
                const shadowSettings = [
                    shadowOffset[0],  // shadowalt
                    shadowOffset[1],  // shadowazm
                    shadowMapSize,  // shadowmapsize
                    lightShadow.shadow.radius,  // shadowradius
                    shadowCatcher.position.z,  // shadowheight
                    selfShadow ? '1' : '0',  // selfshadow
                ];
                return shadowSettings.join('/');
            }
            break;
        //? Debug
        case 'dg':
            if (code) {
                // load setting
                turnOnDebug(code == '1');
            }
            else {
                // copy setting
                return debugOn ? '1' : '0';
            }
            break;
        //? Camera base position
        case 'cp':
            if (code) {
                // load setting
                const coords = code.split('/').map(Number);
                camera.base = new THREE.Vector3(...coords);
            }
            else {
                // copy setting
                return `${camera.base.x}/${camera.base.y}/${camera.base.z}`;
            }
            break;
        //? Camera altitude
        case 'ca':
            if (code) {
                // load setting
                camera.alt = parseFloat(code);
            }
            else {
                // copy setting
                return String(camera.alt);
            }
            break;
        //? Camera azimuth
        case 'cz':
            if (code) {
                // load setting
                camera.azm = parseFloat(code);
            }
            else {
                // copy setting
                return String(camera.azm);
            }
            break;
        //? Camera distance
        case 'cr':
            if (code) {
                // load setting
                camera.radius = parseFloat(code);
            }
            else {
                // copy setting
                return String(camera.radius);
            }
            break;
        default:
            console.error(`"${code}" is not a valid tag!`)
            break;
    }
}

function copySettings() {
    let clipboardCode = '##EPPrevSttgs##;';
    for (const chkbox of copyPanel.querySelectorAll('input')) {
        if (chkbox.checked) {
            const tag = chkbox.dataset.tag;
            const code = settingsCode(tag);
            clipboardCode += `${tag}:${code};`;
        }
    }
    panelVisibility(copyPanel, -1);
    navigator.clipboard.writeText(clipboardCode);
    console.log('Settings copied!');
}

function loadSettings() {
    // const clipboardCode = '##EPPrevSttgs##;mt:0;wo:0.8;et:3;st:1;ss:45/90/1024/1/3/0;cp:10/0/0;';  //! for test
    // const clipboardCode = '##EPPrevSttgs##;mt:1;wo:0.3;et:5;st:0;ss:45/90/1024/1/0/0;dg:0;cp:24.9555/16.6369/5.9436;ca:20;cz:-30;cr:91.72790319951721;';  //! for test
    navigator.clipboard.readText()
        .then(clipboardCode => {
            if (clipboardCode.startsWith('##EPPrevSttgs##;')) {
                for (const codepair of clipboardCode.split(';')) {
                    if (codepair != '##EPPrevSttgs##' && codepair != '') {
                        const [tag, code] = codepair.split(':');
                        settingsCode(tag, code);
                    }
                }
                updateModel(force = true, source = 'loadSettings');
                panelVisibilityAll(-1);
                console.log('Settings pasted!')
            }
        })
        .catch(err => {
            console.error('Failed to read clipboard contents: ', err);
        });

}

//+ -------------------------------------------------------------- +//
//MARK: Animation

/**
 * 
 * @param {number} totalFrames total number of frames
 * @param {function} animationFunc function that adjusts the frame, should take currentFrame, totalFrame, and args as inputs
 * @param {...any} animateFuncArgs additional inputs for the animationFunc
 * @returns 
 */
function animateFrame(totalFrames = 60, animationFunc, ...animateFuncArgs) {

    if (idfName == '') {
        return;
    }

    const frames = [];
    let currentFrame = 0;
    const max_length = Math.ceil(Math.log10(totalFrames));

    // Function to capture a frame from the canvas by copying its content
    function captureFrame() {
        const copy = document.createElement('canvas');
        copy.width = CanvasRenderer.width;
        copy.height = CanvasRenderer.height;
        copy.getContext('2d').drawImage(CanvasRenderer, 0, 0);
        return copy;
    }

    // Recursively generate frames with a delay between each capture
    function generateFrames() {
        if (currentFrame < totalFrames) {
            // Capture the current state of the canvas
            const frame = captureFrame();
            frames.push(frame);
            // animate the camera using the given animationFunc function
            animationFunc(currentFrame, totalFrames, ...animateFuncArgs)
            updateCamera(force = true, source = 'animateCameraHorizontal');
            setTimeout(generateFrames, 25);
            currentFrame++;
        } else {
            // Once all frames are captured, save them as a ZIP file
            saveFramesAsZip();
        }
    }

    // Function to create a ZIP file from the captured frames
    function saveFramesAsZip() {
        const zip = new JSZip();
        // Create an array of promises for converting each frame to a Blob
        const promises = frames.map((frame, index) => {
            return new Promise(resolve => {
                frame.toBlob(blob => {
                    // Add each Blob to the zip file with a unique name
                    code = String(index).padStart(max_length, '0');
                    zip.file(`frame_${code}.png`, blob);
                    resolve();
                });
            });
        });

        // Once all frames are processed, generate the zip file and trigger the download
        Promise.all(promises).then(() => {
            zip.generateAsync({ type: 'blob' }).then(content => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = `${idfName}.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            });
        });
    }

    generateFrames();
}

function animateCameraHorizontal(currentFrame, totalFrames, clockwise) {
    camera.azm += (clockwise ? 1 : -1) * 360 / totalFrames;
}

function animateVisibleHeight(currentFrame, totalFrames, bottomToTop) {
    changeVisFilter('height');
    const zmin = boundary[0][2];
    const zmax = boundary[1][2];
    if (bottomToTop) {
        const toVal = (zmax - zmin) * currentFrame / totalFrames + zmin;
        updateToValue(toVal, heightSliderGroup, true);
    }
    else {
        const toVal = (zmax - zmin) * (1 - currentFrame / totalFrames) + zmin;
        updateToValue(toVal, heightSliderGroup, true);
    }
}
