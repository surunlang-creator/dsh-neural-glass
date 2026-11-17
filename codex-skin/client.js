/**
 * Codex Neural Skin — Client half.
 *
 * Brings the "Codex Neural Skin" concept (mint glass + transformer/CNN canvas
 * stream + floating control panel) to the Harness Web UI: one full-window canvas
 * behind the shell, a mint-tinted glass token layer, and a floating panel that
 * opens from a star in the composer row or at the sidebar foot.
 */
window.__ModuleLoader__.load({
  id: '@local/codex-skin',
  factory(require) {
    'use strict';

    /* ------------------------------------------------------------------ engine
     * Canvas renderer carried over from the Codex skin concept: two scenes,
     * transformer data flow and a CNN image pipeline. It registers itself as
     * window.NeuralGlass and owns its own animation frame.
     */
/* Neural Glass — standalone, dependency-free visual background. */
(function(global){
'use strict';
class NeuralGlass {
 constructor(host,options={}) {
  if(!host) throw new Error('A host element is required');
  this.options={intensity:.8,speed:1,mode:'decoder',scene:'auto',...options}; this.host=host;
  this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-hidden','true');
  Object.assign(this.canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
  this.originalPosition=host.style.position;
  if(getComputedStyle(host).position==='static')host.style.position='relative';
  host.prepend(this.canvas);this.ctx=this.canvas.getContext('2d');this.time=0;this.paused=false;this.dead=false;
  this.motion=matchMedia('(prefers-reduced-motion: reduce)');this.reduced=this.motion.matches;
  this.onMotion=e=>{this.reduced=e.matches;this.last=0;this.draw();this.schedule()};this.motion.addEventListener('change',this.onMotion);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);
  this.onVisibility=()=>{this.last=0;this.schedule()};document.addEventListener('visibilitychange',this.onVisibility);
  this.frame=this.frame.bind(this);this.resize();this.schedule();
 }
 resize(){const r=this.host.getBoundingClientRect();this.w=r.width;this.h=r.height;const d=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(this.w*d);this.canvas.height=Math.round(this.h*d);this.ctx.setTransform(d,0,0,d,0,0);this.draw()}
 configure(options){Object.assign(this.options,options);this.draw()}
 pause(value=true){this.paused=value;this.last=0;this.draw();this.schedule()}
 schedule(){cancelAnimationFrame(this.raf);this.raf=0;if(!this.dead&&!this.paused&&!this.reduced&&!document.hidden)this.raf=requestAnimationFrame(this.frame)}
 destroy(){this.dead=true;cancelAnimationFrame(this.raf);this.resizeObserver.disconnect();document.removeEventListener('visibilitychange',this.onVisibility);this.motion.removeEventListener('change',this.onMotion);this.canvas.remove();this.host.style.position=this.originalPosition}
 frame(now){if(this.dead)return;if(!document.hidden&&!this.paused&&!this.reduced){if(this.last)this.time+=Math.min((now-this.last)/1000,.05)*this.options.speed;this.draw()}this.last=now;this.schedule()}
 // CNN feature extraction is computed; the final class highlight is a labeled scenario.
 prepareCNN(){
  if(this.cnnSamples)return;
  const samples=[
   {name:'CAT / 猫',pixels:['000000000000','001000000100','001100001100','001111111100','001111111100','001011110100','001111111100','000111111000','000011110000','000111111000','001111111100','000000000000']},
   {name:'CAR / 汽车',pixels:['000000000000','000000000000','000011110000','000111111000','001101101100','011111111110','011111111110','011111111110','001100001100','001100001100','000000000000','000000000000']},
   {name:'FLOWER / 花',pixels:['000000000000','000011110000','000111111000','001110011100','001100001100','000110011000','000011110000','000001100000','001101100000','000111100000','000001100000','000001100000']}
  ];
  const kernels=[[-1,0,1,-2,0,2,-1,0,1],[-1,-2,-1,0,0,0,1,2,1],[0,-1,0,-1,4,-1,0,-1,0]];
  this.cnnSamples=samples.map(sample=>{
   const input=sample.pixels.map(row=>Array.from(row,Number));
   const features=kernels.map(kernel=>Array.from({length:10},(_,y)=>Array.from({length:10},(_,x)=>{
    let sum=0;for(let ky=0;ky<3;ky++)for(let kx=0;kx<3;kx++)sum+=input[y+ky][x+kx]*kernel[ky*3+kx];return Math.max(0,sum);
   })));
   const pooled=features.map(map=>Array.from({length:5},(_,y)=>Array.from({length:5},(_,x)=>Math.max(map[y*2][x*2],map[y*2][x*2+1],map[y*2+1][x*2],map[y*2+1][x*2+1]))));
   return {...sample,input,features,pooled};
  });
 }
 drawCNN(t){
  this.prepareCNN();const c=this.ctx,I=this.options.intensity;
  // Auto scenes last 20 seconds. Each CNN appearance advances to another sample.
  const auto=this.options.scene==='auto';const sampleIndex=Math.floor(t/(auto?40:20))%3;
  const sample=this.cnnSamples[sampleIndex],phase=t%20;
  const conv=Math.max(0,Math.min(1,(phase-2)/5)),pool=Math.max(0,Math.min(1,(phase-7)/4));
  const flatten=Math.max(0,Math.min(1,(phase-11)/2)),classify=Math.max(0,Math.min(1,(phase-13)/3)),done=phase>=16;
  const ink=(color,a=1)=>{c.fillStyle=color;c.strokeStyle=color;c.globalAlpha=I*a};
  const text=(s,x,y,size=11,color='#8bb8a7',a=1)=>{ink(color,a);c.font=`${size}px ui-monospace, SFMono-Regular, monospace`;c.fillText(s,x,y)};
  const box=(x,y,w,h,color='#8bb8a7',a=.3)=>{ink(color,a);c.lineWidth=1;c.strokeRect(x,y,w,h)};
  const circle=(x,y,r,a=.3,color='#8fe6c1')=>{ink(color,a);c.lineWidth=1;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();ink(color,a*.2);c.fill()};
  const path=(x,y,X,Y,progress=0,color='#8fe6c1')=>{ink(color,.15);c.lineWidth=.8;c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.stroke();if(progress>0&&progress<1){for(let k=0;k<7;k++){const p=progress-k*.018;if(p<0)continue;ink(color,(1-k/7)*.8);c.beginPath();c.arc(x+(X-x)*p,y+(Y-y)*p,2,0,Math.PI*2);c.fill()}}};
  const grid=(values,x,y,cell,color,visible=1,max=4)=>{values.forEach((row,r)=>row.forEach((v,col)=>{const index=r*row.length+col;const lit=index<visible*values.length*row.length;ink(color,lit?.05+.7*v/max:.025);c.fillRect(x+col*cell,y+r*cell,cell-1,cell-1)}))};
  text('VISION PIPELINE / CNN',282,178,15,'#b4e3cf');
  text('卷积特征 → 最大池化 → 神经元传导 → 示例类别匹配',282,207,12);
  text('本地示意 · 特征与池化按数值计算 · 分类结果为预设演示',282,233,10,'#719a8b');
  const stages=['图像输入','3×3 卷积 + ReLU','2×2 最大池化','展平向量','分类网络','匹配结果'];
  const stage=phase<2?0:phase<7?1:phase<11?2:phase<13?3:phase<16?4:5;
  stages.forEach((label,i)=>{circle(294+i*174,275,3,i===stage?1:.25);text(label,305+i*174,279,9,i===stage?'#c1efd7':'#648b7c')});
  text('01 / INPUT',282,326);grid(sample.input,282,350,11,'#a4dfcc',1,1);box(277,345,142,142);
  text('12 × 12 · '+sample.name,282,515,10);
  // Visible window and corresponding output cell advance through all 100 valid positions.
  const scan=Math.min(99,Math.floor(conv*100)),sx=scan%10,sy=Math.floor(scan/10);
  if(phase>=2&&phase<7){box(282+sx*11,350+sy*11,32,32,'#f1d88d',1);text('KERNEL 3×3',282,542,10,'#e7cf85')}
  path(422,416,480,416,phase>=2&&phase<7?(phase*.8)%1:0,'#e6c96b');
  text('02 / FEATURE MAPS',480,326);
  for(let channel=2;channel>=0;channel--){const x=480+channel*16,y=350+channel*16;
   ink('#0a1718',.95);c.fillRect(x-3,y-3,106,106);grid(sample.features[channel],x,y,10,['#72dacc','#dbc982','#d791af'][channel],conv);box(x-3,y-3,106,106);
   if(channel===0&&phase>=2&&phase<7)box(x+sx*10,y+sy*10,9,9,'#f1d88d',1);
  }
  text('10 × 10 × 3',480,515,10);text('VALID / STRIDE 1',480,536,9,'#648b7c');
  path(625,416,665,416,phase>=7&&phase<11?(phase*.8)%1:0);
  text('03 / MAX POOL',665,326);
  for(let channel=2;channel>=0;channel--){const x=665+channel*13,y=367+channel*13;ink('#0a1718',.95);c.fillRect(x-3,y-3,76,76);grid(sample.pooled[channel],x,y,14,['#72dacc','#dbc982','#d791af'][channel],pool);box(x-3,y-3,76,76)}
  const pi=Math.min(24,Math.floor(pool*25)),px=pi%5,py=Math.floor(pi/5);
  if(phase>=7&&phase<11){
   box(480+px*20,350+py*20,19,19,'#e6c96b',1);box(665+px*14,367+py*14,13,13,'#e6c96b',1);
   const f=sample.features[0],values=[f[py*2][px*2],f[py*2][px*2+1],f[py*2+1][px*2],f[py*2+1][px*2+1]];
   text('max('+values.join(',')+') = '+sample.pooled[0][py][px],629,554,10,'#e6c96b');
  }
  text('5 × 5 × 3',665,515,10);text('STRIDE 2',665,536,9,'#648b7c');
  path(772,416,807,416,phase>=11&&phase<13?(phase*.8)%1:0);
  text('04 / FLATTEN',798,326,10);const vector=sample.pooled.flat(2);
  vector.forEach((v,i)=>{ink('#a0dfc2',i/75<flatten?.12+v*.16:.03);c.fillRect(812+(i%3)*7,350+Math.floor(i/3)*6,5,4)});
  text('75 values',798,535,9);path(840,416,875,416,phase>=13&&phase<16?(phase*.9)%1:0);
  text('05 / DENSE',880,326);const sizes=[6,9,3],pts=sizes.map((n,l)=>Array.from({length:n},(_,i)=>({x:885+l*76,y:416+(i-(n-1)/2)*22})));
  pts.slice(0,-1).forEach((layer,l)=>layer.forEach((a,i)=>pts[l+1].forEach((b,j)=>path(a.x,a.y,b.x,b.y,classify>0&&classify<1?((phase-13)*.7-i*.07-j*.03+l*.13+4)%1:0,l?'#d8c788':'#8fe6c1'))));
  pts.forEach((layer,l)=>layer.forEach((p,i)=>circle(p.x,p.y,5,l===2&&done?(i===sampleIndex?1:.15):classify>0?.3+.6*Math.pow(.5+.5*Math.sin(phase*4-l-i*.4),4):.2)));
  text('6 → 9 → 3 · 缩略示意',880,550,9,'#648b7c');
  text('06 / MATCH',1123,326);const labels=['猫','汽车','花'];
  labels.forEach((label,i)=>{const y=361+i*48,selected=done&&i===sampleIndex;path(1044,394+i*22,1112,y+8,done&&i===sampleIndex?(phase*.5)%1:0);box(1117,y-12,219,34,selected?'#b5efcc':'#719a8b',selected?.9:.17);text(selected?'✓ '+label:label,1130,y+9,13,selected?'#c2f6d7':'#648b7c');if(selected)text('示例匹配',1262,y+8,10,'#b5efcc')});
  if(done){grid(sample.input,1207,529,7,'#b5efcc',1,1);box(1202,524,94,94,'#b5efcc',.5);text('MATCHED IMAGE',1196,637,9,'#b5efcc')}
  text(done?'对应图像已高亮 · 下一轮自动切换样例':'信号传导中 · 扫描窗口与输出特征同步',282,603,12,done?'#b5efcc':'#87b49f');
  // Thin progress rail leaves the composer's bottom area uncluttered.
  ink('#78b897',.12);c.fillRect(282,631,810,2);ink('#b5efcc',.7);c.fillRect(282,631,810*phase/20,2);
  c.globalAlpha=1;
 }

 draw(){const c=this.ctx;if(!c||!this.w||!this.h)return;const W=this.w,H=this.h,t=this.time;
 c.clearRect(0,0,W,H);c.save();c.scale(W/1440,H/900);c.globalAlpha=this.options.intensity;
 const scene=this.options.scene||'auto',segment=t%20;
 this.canvas.style.opacity=scene==='auto'&&t>0&&!this.reduced&&!this.paused?String(Math.min(1,segment/.6,(20-segment)/.6)):'1';
 if(scene==='cnn'||(scene==='auto'&&Math.floor(t/20)%2===0)){this.drawCNN(t);c.restore();return;}
 const text=(s,x,y,color='#719198',size=11)=>{c.fillStyle=color;c.font=`${size}px ui-monospace, SFMono-Regular, monospace`;c.fillText(s,x,y)};
 const line=(x,y,X,Y,color,alpha=.25)=>{c.globalAlpha=this.options.intensity*alpha;c.strokeStyle=color;c.lineWidth=.7;c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.stroke();c.globalAlpha=this.options.intensity};
 const node=(x,y,r,color,a=.4)=>{c.strokeStyle=color;c.lineWidth=1;c.globalAlpha=this.options.intensity*a;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();c.fillStyle=color;c.globalAlpha=this.options.intensity*a*.22;c.fill();c.globalAlpha=this.options.intensity};
 const pulse=(x,y,X,Y,color,offset=0)=>{line(x,y,X,Y,color,.17);const p=(t*.18+offset)%1;for(let k=0;k<8;k++){const q=p-k*.012;if(q<0)continue;c.globalAlpha=this.options.intensity*(1-k/8)*.9;c.fillStyle=color;c.beginPath();c.arc(x+(X-x)*q,y+(Y-y)*q,2.1-k*.17,0,Math.PI*2);c.fill()}c.globalAlpha=this.options.intensity};
 // A sparse code field, lit only near the moving scan front.
 const code=['x = embed(tokens) + position','q, k, v = x @ Wq, x @ Wk, x @ Wv','scores = q @ k.T / sqrt(d_k)','a = softmax(scores + causal_mask)','context = a @ v','x = x + attention(norm(x))','x = x + mlp(norm(x))','logits = norm(x) @ W_out'];
 for(let i=0;i<34;i++){let y=95+i*24,scan=(t*40)%900;let a=.035+.17*Math.exp(-Math.pow((y-scan)/45,2));c.globalAlpha=a*this.options.intensity;text(code[i%8],27+(i%3)*8,y,'#68c9b8',10)}c.globalAlpha=this.options.intensity;
 text('01 / TOKEN STREAM',70,160);const tokens=this.options.tokens||['A','small','blue','star','lights','the','sky'];
 tokens.forEach((s,i)=>{let x=80+i*174; c.strokeStyle='#36555b';c.strokeRect(x,184,148,39);text(s,x+14,209,'#b5c9cb',15);pulse(x+74,224,x+74,282,'#67d9d0',i*.13);node(x+74,290,7,'#67d9d0',.65)});
 // Attention arcs preserve token relationships rather than arbitrary particle motion.
 for(let i=0;i<tokens.length;i++)for(let j=0;j<=i;j++){const x=154+i*174,X=154+j*174;const active=(Math.floor(t/2)%Math.max(tokens.length,1))===i;c.strokeStyle=active?'#7fe6cf':'#45676d';c.globalAlpha=this.options.intensity*(active?.28:.08);c.beginPath();c.moveTo(x,184);c.quadraticCurveTo((x+X)/2,85-Math.abs(i-j)*10,X,184);c.stroke()}c.globalAlpha=this.options.intensity;
 const colors=['#e6c96b','#6ed8cd','#de91b0'];const names=['Q / QUERY','K / KEY','V / VALUE'];
 names.forEach((s,i)=>{const x=80+i*147;text(s,x,352,colors[i]);for(let row=0;row<4;row++)for(let col=0;col<5;col++){text(((Math.sin(row*9+col*2+i*7+Math.floor(t*.8)))*.9).toFixed(1),x+col*24,377+row*17,colors[i],8)}pulse(154,299,x+54,333,colors[i],i*.21);pulse(x+54,447,278,499,colors[i],i*.27)});
 text('02 / SCALED DOT-PRODUCT',80,484);text('softmax(QKᵀ / √d + mask) V',92,527,'#b4d1ce',13);
 for(let r=0;r<7;r++)for(let k=0;k<7;k++){c.globalAlpha=this.options.intensity*(k>r?.025:.12+.35*(.5+.5*Math.sin(r*4+k+t)));c.fillStyle='#78d7c7';c.fillRect(91+k*19,550+r*19,14,14)}c.globalAlpha=this.options.intensity;text('CAUSAL ATTENTION',252,609,'#648b8b',10);pulse(278,534,278,715,'#79d9c8',.2);
 text(this.options.mode==='encoder'?'03 / ENCODER → CROSS ATTENTION → DECODER':'03 / DECODER BLOCK × N',80,746,'#a0c1bc',12);
 text('Attention → Add & Norm → FFN → Add & Norm',80,771,'#688c88',10);
 if(this.options.mode==='encoder'){text('Encoder memory supplies K, V',80,797,'#d4bd7a',10);pulse(450,745,1065,745,'#d4bd7a',.3)}else pulse(450,745,1065,745,'#79d9c8',.3);
 // Each displayed neuron has its own circle; diagram is a reduced FFN, not literal model width.
 text('04 / FEED-FORWARD NETWORK',1004,352);text('8 → 14 → 14 → 8   ·   SCHEMATIC',1004,375,'#688c88',9);
 const layers=[8,14,14,8],pts=layers.map((n,l)=>Array.from({length:n},(_,i)=>({x:1015+l*99,y:420+(i-(n-1)/2)*19+133})));
 pts.slice(0,-1).forEach((layer,l)=>layer.forEach((a,i)=>pts[l+1].forEach((b,j)=>{line(a.x,a.y,b.x,b.y,'#72bcb1',.07);if((i*7+j*3+l)%11===0)pulse(a.x,a.y,b.x,b.y,l%2?'#d7bd79':'#79d9c8',(i+j)*.07)})));
 pts.forEach((layer,l)=>layer.forEach((p,i)=>node(p.x,p.y,5.5,l===1?'#d7bd79':'#91e3cd',.25+.65*Math.pow(.5+.5*Math.sin(t*2-l*1.1-i*.3),5))));
 ['INPUT','EXPAND','ACTIVATE','PROJECT'].forEach((s,i)=>text(s,994+i*99,711,'#688c88',8));
 pulse(1312,740,1312,800,'#79d9c8',.4);text('05 / NEXT TOKEN',1070,819);text(['light','glows','above','us'][Math.floor(t/4)%4],1240,819,'#b6ead6',14);
 c.restore();
 }
}
global.NeuralGlass=NeuralGlass;
})(window);

    const React = require('react')
    const PACKAGE_ID = '@local/codex-skin'
    const STORE_KEY = 'codex-skin.settings.v1'
    const PREV_THEME_KEY = 'codex-skin.previous-theme'
    const Engine = window.NeuralGlass

    const DEFAULTS = {
      scene: 'auto',
      transparency: 38,
      glow: 65,
      blur: 16,
      speed: 0.8,
      enabled: true,
      paused: false,
      darkBase: true,
    }
    const RANGES = { transparency: [0, 90], glow: [0, 100], blur: [0, 28], speed: [0.2, 2] }
    const PRESETS = {
      focus: { transparency: 12, glow: 20, blur: 20, speed: 0.4 },
      balance: { transparency: 38, glow: 65, blur: 16, speed: 0.8 },
      immersive: { transparency: 65, glow: 90, blur: 8, speed: 1.2 },
    }

    const COPY = {
      zh: {
        title: 'Neural Glass',
        subtitle: '薄荷绿 Codex 风格 · 计算示意，不连接模型',
        scene: '动画场景',
        sceneAuto: '自动轮播',
        sceneTransformer: 'Transformer 光流',
        sceneCnn: 'CNN 图像识别',
        presetFocus: '专注',
        presetBalance: '平衡',
        presetImmersive: '沉浸',
        transparency: '界面透明度',
        solid: '实色',
        clear: '通透',
        glow: '背景光效',
        hidden: '隐藏',
        bright: '明亮',
        blur: '玻璃模糊',
        crisp: '清晰',
        soft: '柔和',
        speed: '动画速度',
        calm: '舒缓',
        flowing: '流动',
        enabled: '启用动态背景',
        paused: '暂停动画',
        darkBase: '深色底座',
        saved: '已自动保存到本机',
        unsaved: '存储不可用 · 仅本次会话生效',
        reset: '恢复默认',
        note: '透明度仅影响面板底色，不降低文字亮度。卷积与池化为真实计算，分类与权重为预设示意，并非模型实时数据。',
        open: 'Codex Neural Skin 设置',
        close: '关闭',
      },
      en: {
        title: 'Neural Glass',
        subtitle: 'Mint Codex style · illustration only',
        scene: 'Scene',
        sceneAuto: 'Auto rotate',
        sceneTransformer: 'Transformer flow',
        sceneCnn: 'CNN pipeline',
        presetFocus: 'Focus',
        presetBalance: 'Balanced',
        presetImmersive: 'Immersive',
        transparency: 'Interface transparency',
        solid: 'Solid',
        clear: 'Clear',
        glow: 'Background glow',
        hidden: 'Hidden',
        bright: 'Bright',
        blur: 'Glass blur',
        crisp: 'Crisp',
        soft: 'Soft',
        speed: 'Animation speed',
        calm: 'Calm',
        flowing: 'Flowing',
        enabled: 'Live background',
        paused: 'Pause animation',
        darkBase: 'Dark base',
        saved: 'Saved on this device',
        unsaved: 'Storage unavailable · this session only',
        reset: 'Reset',
        note: 'Transparency only affects panel fills, never text contrast. Convolution and pooling are computed, the classifier and weights are illustrative.',
        open: 'Codex Neural Skin settings',
        close: 'Close',
      },
    }

    const PANEL_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
button, input, select { font: inherit; }
.card {
  position: fixed; width: min(334px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); overflow: auto;
  padding: 20px; border-radius: 18px; border: 1px solid #719a8d66; color: #dce9e6;
  background: #132125f7; box-shadow: 0 24px 85px #0008; backdrop-filter: blur(24px);
  font: 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
  opacity: 0; transform: translateY(10px); transition: opacity 160ms ease, transform 160ms ease;
}
.card.open { opacity: 1; transform: translateY(0); }
.card[hidden] { display: none; }
.head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
h2 { margin: 0 0 4px; font-size: 16px; font-weight: 600; }
.sub { margin: 0; font-size: 11px; line-height: 1.6; color: #87a29a; }
.x { margin-left: auto; border: 0; background: none; color: #a9c7b8; font-size: 19px; line-height: 1; padding: 2px 6px; border-radius: 6px; cursor: pointer; }
.x:hover { background: #ffffff10; color: #dce9e6; }
.scene { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12px; margin-bottom: 14px; }
.scene select { flex: none; max-width: 175px; padding: 6px 8px; border-radius: 8px; border: 1px solid #ffffff25; background: #18272b; color: #dce9e6; }
.presets { display: flex; gap: 6px; margin-bottom: 18px; }
.presets button { flex: 1; padding: 7px; font-size: 11px; border-radius: 9px; border: 1px solid #ffffff20; background: #18272b; color: inherit; cursor: pointer; }
.presets button:hover { background: #1e3438; }
.presets button[aria-pressed='true'] { border-color: #b9eed7; color: #b9eed7; background: #b9eed714; }
.field { margin: 16px 0; }
.fhead { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; font-size: 12px; }
.fhead output { color: #b9eed7; font: 11px ui-monospace, monospace; }
input[type='range'] { display: block; width: 100%; height: 18px; margin: 0; accent-color: #b9eed7; cursor: pointer; }
.ends { display: flex; justify-content: space-between; margin-top: 5px; font-size: 10px; color: #87a29a; }
.switch { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; font-size: 12px; }
.switch input { width: 36px; height: 20px; accent-color: #b9eed7; cursor: pointer; }
.foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid #ffffff14; }
.saved { font-size: 11px; color: #87a29a; }
.reset { padding: 6px 11px; font-size: 11px; border-radius: 8px; border: 1px solid #ffffff20; background: transparent; color: #cfe4da; cursor: pointer; }
.reset:hover { background: #ffffff10; }
.note { margin: 12px 0 0; font-size: 10.5px; line-height: 1.65; color: #7f978b; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #b9eed7; outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .card { transition: none; } }
`

    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

    function sanitize(patch) {
      const next = { ...DEFAULTS }
      if (patch === null || typeof patch !== 'object') return next
      for (const [key, fallback] of Object.entries(DEFAULTS)) {
        const value = patch[key]
        if (typeof fallback === 'boolean') {
          if (typeof value === 'boolean') next[key] = value
        } else if (key === 'scene') {
          if (['auto', 'transformer', 'cnn'].includes(value)) next[key] = value
        } else if (typeof value === 'number' && Number.isFinite(value)) {
          const range = RANGES[key]
          if (range !== undefined) next[key] = clamp(value, range[0], range[1])
        }
      }
      return next
    }

    function loadState() {
      try {
        const raw = window.localStorage.getItem(STORE_KEY)
        return raw === null ? { ...DEFAULTS } : sanitize(JSON.parse(raw))
      } catch {
        return { ...DEFAULTS }
      }
    }

    /** Resolve the UI language from the host locale, then the browser. */
    function makeTranslator(ctx) {
      let lang = ''
      try {
        const locale = ctx.get('locale')
        if (locale !== undefined && typeof locale.getLocale === 'function') {
          const snapshot = locale.getLocale()
          if (snapshot !== null && snapshot !== undefined && typeof snapshot.id === 'string') lang = snapshot.id
        }
      } catch {
        // fall through to the browser language
      }
      if (lang === '') {
        lang = typeof navigator !== 'undefined' && typeof navigator.language === 'string' ? navigator.language : 'en'
      }
      const dict = String(lang).toLowerCase().startsWith('zh') ? COPY.zh : COPY.en
      return (key) => (dict[key] === undefined ? key : dict[key])
    }

    /** Mint glass: one coat is the square root of the requested coverage because
     *  the shell stacks bg-base on the frame, the centre column and the chat. */
    function glassTokens(transparency) {
      const effective = 1 - clamp(transparency, 0, 90) / 100
      const coat = 1 - Math.sqrt(1 - effective)
      const dark = (a) => `rgba(9, 17, 21, ${a.toFixed(3)})`
      const deep = (a) => `rgba(11, 21, 25, ${a.toFixed(3)})`
      const pale = (a) => `rgba(240, 248, 244, ${a.toFixed(3)})`
      const paleDeep = (a) => `rgba(250, 253, 251, ${a.toFixed(3)})`
      return {
        '--dsw-alias-bg-base': { dark: dark(coat), light: pale(coat + 0.08) },
        '--dsw-alias-bg-layer-1': { dark: deep(coat + 0.1), light: paleDeep(coat + 0.2) },
        '--dsw-alias-bg-layer-2': { dark: deep(coat + 0.16), light: paleDeep(coat + 0.26) },
        '--dsw-alias-bg-layer-3': { dark: deep(coat + 0.22), light: paleDeep(coat + 0.32) },
        '--dsw-alias-bg-overlay': { dark: 'rgba(10, 19, 23, 0.97)', light: 'rgba(255, 255, 255, 0.985)' },
        '--dsw-alias-card-fill': { dark: deep(coat + 0.2), light: paleDeep(coat + 0.28) },
        '--dsw-alias-bg-mask-1': { dark: 'rgba(3, 7, 9, 0.55)', light: 'rgba(226, 238, 232, 0.5)' },
        '--dsw-alias-border-l1': { dark: 'rgba(185, 238, 215, 0.12)', light: 'rgba(28, 96, 74, 0.12)' },
        '--dsw-alias-border-l2': { dark: 'rgba(185, 238, 215, 0.18)', light: 'rgba(28, 96, 74, 0.18)' },
        '--dsw-alias-border-l3': { dark: 'rgba(185, 238, 215, 0.24)', light: 'rgba(28, 96, 74, 0.22)' },
        '--dsw-alias-border-l4': { dark: 'rgba(185, 238, 215, 0.28)', light: 'rgba(28, 96, 74, 0.26)' },
        '--dsw-specific-sidebar-fill': { dark: dark(coat + 0.14), light: pale(coat + 0.16) },
        '--dsw-specific-sidebar-tint': {
          dark: `color-mix(in srgb, rgba(9, 17, 21, ${(coat + 0.14).toFixed(3)}) 50%, transparent)`,
          light: 'color-mix(in srgb, rgba(238, 246, 242, 0.75) 50%, transparent)',
        },
        '--dsw-specific-sidebar-wash-top': { dark: 'rgba(120, 214, 178, 0.09)', light: 'rgba(62, 158, 124, 0.09)' },
        '--dsw-specific-sidebar-wash-bottom': { dark: 'rgba(90, 160, 190, 0.08)', light: 'rgba(70, 140, 160, 0.07)' },
        '--dsw-specific-input-major': { dark: deep(Math.min(0.68, coat + 0.34)), light: paleDeep(coat + 0.34) },
        '--dsw-specific-selector': { dark: deep(coat + 0.28), light: paleDeep(coat + 0.3) },
      }
    }

    const STAR_SVG = React.createElement('svg', { viewBox: '0 0 16 16', width: 15, height: 15, 'aria-hidden': 'true' },
      React.createElement('path', {
        d: 'M8 1.8l1.7 4.3 4.5.3-3.5 2.9 1.1 4.4L8 11.4 4.2 13.7l1.1-4.4L1.8 6.4l4.5-.3z',
        fill: 'currentColor', opacity: 0.92,
      }))

    return {
      inject: ['slots', 'theme'],
      apply(ctx) {
        const tr = makeTranslator(ctx)
        const themeSvc = () => ctx.get('theme')
        let state = loadState()
        let layer = null
        let engine = null
        let groundTag = null
        let tokenDispose = null
        let lastTransparency = null
        let restoreTheme = null
        let respectChoice = false
        let panelHost = null
        let panelCard = null
        let panelOpen = false
        let closeTimer = 0
        let disposed = false

        function persist() {
          try {
            window.localStorage.setItem(STORE_KEY, JSON.stringify(state))
            return true
          } catch {
            return false
          }
        }

        function scheme() {
          const theme = themeSvc()
          if (theme === undefined || typeof theme.getTheme !== 'function') return 'dark'
          const snapshot = theme.getTheme()
          return snapshot !== null && snapshot.active !== undefined ? snapshot.active.colorScheme : 'dark'
        }

        function setGround(next) {
          document.documentElement.style.setProperty('--codex-skin-ground', next === 'light' ? '#f0f8f4' : '#060b0f')
        }

        function forceDark() {
          const theme = themeSvc()
          if (!state.darkBase || respectChoice) return
          if (theme === undefined || typeof theme.getTheme !== 'function' || typeof theme.setTheme !== 'function') return
          const snapshot = theme.getTheme()
          if (snapshot === null || snapshot.active === undefined) return
          if (snapshot.active.colorScheme === 'dark' || restoreTheme !== null) return
          restoreTheme = String(snapshot.preference)
          try {
            theme.setTheme('dark')
          } catch {
            restoreTheme = null
          }
        }

        function restoreThemeBase() {
          const theme = themeSvc()
          if (restoreTheme === null || theme === undefined || typeof theme.setTheme !== 'function') {
            restoreTheme = null
            return
          }
          const preference = restoreTheme
          restoreTheme = null
          try {
            theme.setTheme(preference)
          } catch {
            // the old preference may be gone; keep the dark base
          }
        }

        function applyTransparency() {
          const theme = themeSvc()
          if (theme === undefined || typeof theme.overrideTokens !== 'function') return
          if (lastTransparency === state.transparency) return
          lastTransparency = state.transparency
          if (tokenDispose !== null) tokenDispose()
          tokenDispose = theme.overrideTokens(PACKAGE_ID, glassTokens(state.transparency))
        }

        function updateEngine() {
          if (engine === null) return
          engine.configure({ intensity: state.glow / 100, speed: state.speed, scene: state.scene })
          engine.pause(state.paused || !state.enabled)
          if (layer !== null) layer.style.display = state.enabled ? 'block' : 'none'
        }

        function mount() {
          if (layer !== null || document.body === null) return
          setGround(scheme())
          forceDark()
          groundTag = document.createElement('style')
          groundTag.setAttribute('data-plugin', PACKAGE_ID)
          groundTag.textContent = [
            'html { background-color: var(--codex-skin-ground, #060b0f) !important; }',
            'body { background-color: transparent !important; }',
          ].join('\n')
          document.head.appendChild(groundTag)

          layer = document.createElement('div')
          layer.setAttribute('data-codex-skin', '')
          layer.setAttribute('aria-hidden', 'true')
          layer.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:-1', 'pointer-events:none',
            'overflow:hidden', 'background:transparent',
          ].join(';')
          document.body.insertBefore(layer, document.body.firstChild)
          engine = new Engine(layer, { intensity: state.glow / 100, speed: state.speed, scene: state.scene })
          applyTransparency()
          updateEngine()
        }

        function unmount() {
          if (engine !== null) {
            engine.destroy()
            engine = null
          }
          if (layer !== null) {
            layer.remove()
            layer = null
          }
          if (groundTag !== null) {
            groundTag.remove()
            groundTag = null
          }
          if (tokenDispose !== null) {
            tokenDispose()
            tokenDispose = null
          }
          lastTransparency = null
          document.documentElement.style.removeProperty('--codex-skin-ground')
          restoreThemeBase()
        }

        function sync() {
          if (disposed) return
          if (!state.enabled) {
            unmount()
            return
          }
          if (document.body === null) return
          mount()
          if (scheme() !== 'light') forceDark()
          applyTransparency()
          updateEngine()
        }

        function patch(next) {
          state = sanitize({ ...state, ...next })
          persist()
          sync()
          renderPanel()
        }

        // ---------------------------------------------------------------- panel

        function ensurePanel() {
          if (panelHost !== null) return
          panelHost = document.createElement('div')
          panelHost.setAttribute('data-codex-skin-panel', '')
          panelHost.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none'
          const shadow = panelHost.attachShadow({ mode: 'open' })
          shadow.innerHTML = `<style>${PANEL_CSS}</style><section class="card" role="dialog" aria-label="${tr('title')}" hidden></section>`
          panelCard = shadow.querySelector('.card')
          panelCard.addEventListener('input', onPanelInput)
          panelCard.addEventListener('click', onPanelClick)
          panelHost.addEventListener('pointerdown', (event) => { event.stopPropagation() })
          document.body.appendChild(panelHost)
        }

        function buildPanel() {
          const value = (key, text) => `<div class="field" data-field="${key}">
            <div class="fhead"><label for="cs-${key}">${tr(key)}</label><output data-out="${key}">${text}</output></div>
            <input id="cs-${key}" type="range" min="${RANGES[key][0]}" max="${RANGES[key][1]}" step="${key === 'speed' ? 0.1 : 1}" data-range="${key}">
            <div class="ends"><span>${key === 'transparency' ? tr('solid') : key === 'glow' ? tr('hidden') : key === 'blur' ? tr('crisp') : tr('calm')}</span><span>${key === 'transparency' ? tr('clear') : key === 'glow' ? tr('bright') : key === 'blur' ? tr('soft') : tr('flowing')}</span></div>
          </div>`
          panelCard.innerHTML = `
            <div class="head">
              <div><h2>${tr('title')}</h2><p class="sub">${tr('subtitle')}</p></div>
              <button class="x" type="button" data-act="close" aria-label="${tr('close')}">×</button>
            </div>
            <label class="scene"><span>${tr('scene')}</span><select data-scene>
              <option value="auto">${tr('sceneAuto')}</option>
              <option value="transformer">${tr('sceneTransformer')}</option>
              <option value="cnn">${tr('sceneCnn')}</option>
            </select></label>
            <div class="presets">
              <button type="button" data-preset="focus">${tr('presetFocus')}</button>
              <button type="button" data-preset="balance">${tr('presetBalance')}</button>
              <button type="button" data-preset="immersive">${tr('presetImmersive')}</button>
            </div>
            ${value('transparency', '38%')}
            ${value('glow', '65%')}
            ${value('blur', '16 px')}
            ${value('speed', '0.8×')}
            <label class="switch"><span>${tr('enabled')}</span><input type="checkbox" data-switch="enabled"></label>
            <label class="switch"><span>${tr('paused')}</span><input type="checkbox" data-switch="paused"></label>
            <label class="switch"><span>${tr('darkBase')}</span><input type="checkbox" data-switch="darkBase"></label>
            <div class="foot"><span class="saved" role="status" aria-live="polite"></span><button class="reset" type="button" data-act="reset">${tr('reset')}</button></div>
            <p class="note">${tr('note')}</p>`
          panelCard.querySelector('.saved').textContent = '…'
        }

        function renderPanel() {
          if (panelCard === null) return
          if (panelCard.childElementCount === 0) buildPanel()
          for (const [key, range] of Object.entries(RANGES)) {
            const input = panelCard.querySelector(`[data-range="${key}"]`)
            const output = panelCard.querySelector(`[data-out="${key}"]`)
            if (input === null || output === null) continue
            input.value = String(state[key])
            output.textContent = key === 'speed'
              ? `${Number(state.speed).toFixed(1)}×`
              : key === 'blur' ? `${state.blur} px` : `${state[key]}%`
          }
          const scene = panelCard.querySelector('[data-scene]')
          if (scene !== null) scene.value = state.scene
          for (const key of ['enabled', 'paused', 'darkBase']) {
            const input = panelCard.querySelector(`[data-switch="${key}"]`)
            if (input !== null) input.checked = state[key] === true
          }
          for (const [name, preset] of Object.entries(PRESETS)) {
            const button = panelCard.querySelector(`[data-preset="${name}"]`)
            if (button === null) continue
            const active = Object.keys(preset).every((key) => Math.abs(preset[key] - state[key]) < 0.001)
            button.setAttribute('aria-pressed', String(active))
          }
          const saved = panelCard.querySelector('.saved')
          if (saved !== null) saved.textContent = persist() ? tr('saved') : tr('unsaved')
        }

        function onPanelInput(event) {
          const target = event.target
          if (target.matches('[data-range]')) {
            patch({ [target.dataset.range]: Number(target.value) })
            return
          }
          if (target.matches('[data-switch]')) {
            patch({ [target.dataset.switch]: target.checked })
            return
          }
          if (target.matches('[data-scene]')) patch({ scene: target.value })
        }

        function onPanelClick(event) {
          const preset = event.target.closest('[data-preset]')
          if (preset !== null) {
            patch({ ...PRESETS[preset.dataset.preset] })
            return
          }
          const action = event.target.closest('[data-act]')
          if (action === null) return
          if (action.dataset.act === 'close') closePanel()
          else if (action.dataset.act === 'reset') patch({ ...DEFAULTS })
        }

        function placePanel(anchor) {
          if (panelCard === null) return
          const margin = 12
          panelCard.style.visibility = 'hidden'
          panelCard.style.left = '0px'
          panelCard.style.top = '0px'
          const rect = panelCard.getBoundingClientRect()
          const box = anchor !== null && anchor !== undefined && anchor.getBoundingClientRect !== undefined
            ? anchor.getBoundingClientRect()
            : { left: window.innerWidth - 60, top: 70, right: window.innerWidth - 30, bottom: 96 }
          const clampX = (x) => Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin))
          const clampY = (y) => Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin))
          let left
          let top
          if (box.left - margin >= rect.width + 12) {
            left = box.left - rect.width - 12
            top = clampY(box.top)
          } else {
            left = clampX(box.right - rect.width)
            const above = box.top - rect.height - 12
            top = above >= margin ? above : clampY(box.bottom + 12)
          }
          panelCard.style.left = `${left}px`
          panelCard.style.top = `${top}px`
          panelCard.style.visibility = ''
        }

        function openPanel(anchor) {
          ensurePanel()
          renderPanel()
          window.clearTimeout(closeTimer)
          panelCard.hidden = false
          placePanel(anchor)
          panelCard.classList.add('open')
          panelOpen = true
          const first = panelCard.querySelector('input, select, button')
          if (first !== null) first.focus({ preventScroll: true })
        }

        function closePanel() {
          if (!panelOpen || panelCard === null) return
          panelOpen = false
          panelCard.classList.remove('open')
          const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
          if (reduce) panelCard.hidden = true
          else closeTimer = window.setTimeout(() => { if (!panelOpen && panelCard !== null) panelCard.hidden = true }, 180)
        }

        function togglePanel(anchor) {
          if (panelOpen) closePanel()
          else openPanel(anchor)
        }

        // ------------------------------------------------------------- lifecycle

        ctx.effect(() => {
          const onTheme = (snapshot) => {
            const next = snapshot !== null && snapshot.active !== undefined ? snapshot.active.colorScheme : 'dark'
            setGround(next)
            const preference = snapshot !== null && snapshot.preference !== undefined ? String(snapshot.preference) : null
            if (next === 'light' && preference === 'light' && restoreTheme !== null) respectChoice = true
            if (restoreTheme === null) forceDark()
          }
          const offTheme = ctx.on('theme/change', onTheme)
          const onVisibility = () => {
            if (!document.hidden && state.enabled) sync()
          }
          document.addEventListener('visibilitychange', onVisibility)
          window.addEventListener('focus', onVisibility)
          const onKey = (event) => {
            if (event.key === 'Escape' && panelOpen) {
              event.preventDefault()
              closePanel()
            }
          }
          const onDown = (event) => {
            if (!panelOpen || panelHost === null) return
            if (!event.composedPath().includes(panelHost)) closePanel()
          }
          document.addEventListener('keydown', onKey)
          document.addEventListener('pointerdown', onDown, true)
          const onReady = () => sync()
          if (document.body !== null) sync()
          else document.addEventListener('DOMContentLoaded', onReady, { once: true })
          return () => {
            document.removeEventListener('DOMContentLoaded', onReady)
            document.removeEventListener('visibilitychange', onVisibility)
            document.removeEventListener('keydown', onKey)
            document.removeEventListener('pointerdown', onDown, true)
            window.removeEventListener('focus', onVisibility)
            offTheme()
            window.clearTimeout(closeTimer)
            if (panelHost !== null) {
              panelHost.remove()
              panelHost = null
              panelCard = null
            }
            disposed = true
            unmount()
          }
        }, 'codex-skin: background + panel')

        ctx.effect(() => ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'codex-skin-trigger',
          order: 6,
        }, function CodexSkinSidebarTrigger() {
          const ref = React.useRef(null)
          return React.createElement('button', {
            type: 'button',
            ref,
            className: 'codex-skin-trigger',
            'aria-label': tr('open'),
            title: tr('open'),
            onClick: () => togglePanel(ref.current),
          }, STAR_SVG)
        })), 'codex-skin: sidebar trigger')

        ctx.effect(() => ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
          name: 'conversation.input.right',
          id: 'codex-skin-trigger',
          order: 0,
        }, function CodexSkinComposerTrigger() {
          const ref = React.useRef(null)
          return React.createElement('button', {
            type: 'button',
            ref,
            className: 'codex-skin-trigger',
            'aria-label': tr('open'),
            title: tr('open'),
            onClick: () => togglePanel(ref.current),
          }, STAR_SVG)
        })), 'codex-skin: composer trigger')

        ctx.effect(() => {
          const tag = document.createElement('style')
          tag.setAttribute('data-plugin', PACKAGE_ID)
          tag.textContent = `.codex-skin-trigger{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none}
.codex-skin-trigger:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.codex-skin-trigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}`
          document.head.appendChild(tag)
          return () => { tag.remove() }
        }, 'codex-skin: trigger styles')
      },
    }
  },
})
