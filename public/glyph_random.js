/* Broad Unicode glyph randomizer shared by CPU and multiplayer. */
(function(){
  'use strict';
  const SEG=typeof Intl.Segmenter==='function'?new Intl.Segmenter('ja',{granularity:'grapheme'}):null;
  const isGlyph=s=>{
    if(!s||/[\u0000-\u001f\u007f-\u009f\s]/u.test(s))return false;
    if(new TextEncoder().encode(s).length>64)return false;
    return SEG?Array.from(SEG.segment(s)).length===1:Array.from(s).length===1;
  };
  const examples=['❤️','☄️','⚔️','🛡️','♨️','☺️','⭐','👨‍🚀','👩‍🚀','👩‍💻','👨‍👩‍👧','🏳️‍🌈','🇯🇵','🇺🇸','🇫🇷','🌸','🔥','😂','💥','🌀','💎','🚀','🍙','🐱','🎯','👑','⚡','🌙','👻'];
  // Character ranges, including less familiar Kanji, Kana, Latin alphabets,
  // numerals, punctuation, symbols and emoji. A glyph may comprise multiple code points.
  const ranges=[
    [0x21,0x7e], [0xa1,0x24f], [0x370,0x52f], [0x1e00,0x1eff],
    [0x2c00,0x2c7f], [0x2e80,0x2eff], [0x2f00,0x2fdf],
    [0x3000,0x30ff], [0x31a0,0x31ff], [0x3200,0x33ff],
    [0x3400,0x4dbf], [0x4e00,0x9fff], [0xf900,0xfaff],
    [0xac00,0xd7a3], [0xff01,0xffef],
    [0x2000,0x27bf],[0x2900,0x2bff],
    [0x1f000,0x1faff],
    [0x20000,0x2a6df], [0x2a700,0x2b73f], [0x2b740,0x2b81f],
    [0x2b820,0x2ceaf],[0x2ceb0,0x2ebef]
  ];
  let pool=null,categories=null;
  function all(){
    if(pool)return pool;
    const result=[],seen=new Set();
    const sections={han:[],kana:[],letter:[],symbol:[],emoji:[]};
    function add(ch){
      if(seen.has(ch)||!isGlyph(ch)||!/[\p{Letter}\p{Number}\p{Punctuation}\p{Symbol}]/u.test(ch))return;
      seen.add(ch);result.push(ch);
      if(/\p{Script=Han}/u.test(ch))sections.han.push(ch);
      else if(/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(ch))sections.kana.push(ch);
      else if(Array.from(ch).length>1||/[\p{Emoji_Presentation}]/u.test(ch))sections.emoji.push(ch);
      else if(/[\p{Letter}\p{Number}]/u.test(ch))sections.letter.push(ch);
      else sections.symbol.push(ch);
    }
    for(const [start,end] of ranges){
      for(let cp=start;cp<=end;cp++)add(String.fromCodePoint(cp));
    }
    for(const ch of examples)add(ch);
    if(typeof window.MOJI_STROKES==='object')for(const ch of Object.keys(window.MOJI_STROKES))add(ch);
    pool=result;categories=Object.values(sections).filter(items=>items.length>0);return pool;
  }
  function choice(list){return list[Math.floor(Math.random()*list.length)]}
  // Choose a character category first, then a glyph within it. Rare emoji
  // and Latin/number symbols should not be drowned out by 80,000 Kanji.
  function roll(exclude=new Set()){
    all();
    for(let n=0;n<120;n++){
      const ch=choice(choice(categories));
      if(!exclude.has(ch))return ch;
    }
    return pool.find(ch=>!exclude.has(ch))||'火';
  }
  function sample(count=5){
    const used=new Set(),out=[];
    while(out.length<count){
      const ch=roll(used);
      if(used.has(ch))break;
      used.add(ch);out.push(ch);
    }
    return out;
  }
  window.MojiRandom={all,sample,roll,examples};
})();
