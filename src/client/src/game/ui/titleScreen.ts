import "./titleScreen.css";

export function mountTitleScreen(onStart: () => void, onOnline?: () => void): () => void {
  const host = document.createElement("main");
  host.className = "title-screen";
  host.innerHTML = `
    <header class="title-screen__header">
      <span class="title-screen__brand"><span aria-hidden="true">◈</span> THE ETERNAL WHEEL</span>
      <span class="title-screen__edition">REAL-TIME CARD BATTLE</span>
    </header>
    <div class="title-screen__main">
      <section class="title-screen__intro" aria-labelledby="title-heading">
        <p class="title-screen__eyebrow"><span></span> 運命を紡ぐ、召喚の物語</p>
        <h1 id="title-heading">The Eternal<br><em>Wheel</em><span>エターナル・ウィール</span></h1>
        <p class="title-screen__tagline">その一手が、<br>戦場の運命を変える。</p>
        <p class="title-screen__description">仲間を選び、魔法陣を築き、召喚獣を呼び醒ます。<br>あなただけの編成で挑む、リアルタイムカードバトル。</p>
        <button class="title-screen__start" type="button"><span><small>BUILD YOUR DECK</small>CPU戦へ</span><span aria-hidden="true">↗</span></button>
        <p class="title-screen__start-note">カードを選んで、最初の戦いへ</p>
      </section>
      <div class="title-screen__visual" aria-hidden="true">
        <div class="title-screen__orbit title-screen__orbit--outer"></div>
        <div class="title-screen__orbit title-screen__orbit--inner"></div>
        <span class="title-screen__star title-screen__star--one">✧</span><span class="title-screen__star title-screen__star--two">✧</span>
        <div class="title-screen__card title-screen__card--left"><img src="/assets/units/cards/SC019.png" alt=""></div>
        <div class="title-screen__card title-screen__card--right"><img src="/assets/units/cards/SC014.png" alt=""></div>
        <div class="title-screen__card title-screen__card--main"><img src="/assets/units/cards/SC017.png" alt=""><div><small>THE MOONLIT WITCH</small><strong>三日月の魔女 ローレライ</strong><span>◆ &nbsp; SUMMONER'S ARCHIVE &nbsp; ◆</span></div></div>
        <p class="title-screen__art-caption">THE WHEEL OF FATE IS IN YOUR HANDS</p>
      </div>
    </div>
    <footer class="title-screen__footer">
      <div><span>01</span><p><strong>編成</strong><small>仲間を選び、戦略を描く</small></p></div>
      <div><span>02</span><p><strong>構築</strong><small>戦場に魔法陣を築く</small></p></div>
      <div><span>03</span><p><strong>召喚</strong><small>召喚獣と勝利をつかむ</small></p></div>
      <span class="title-screen__footer-mark" aria-hidden="true">◈</span>
    </footer>`;
  host.querySelector("button")!.addEventListener("click", onStart);
  if (onOnline) {const button=document.createElement('button');button.className='title-screen__start';button.textContent='オンライン対戦';button.style.marginTop='12px';button.addEventListener('click',onOnline);host.querySelector('.title-screen__start')!.after(button);}
  document.body.append(host);
  return () => host.remove();
}
