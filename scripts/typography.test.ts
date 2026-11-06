import assert from "node:assert/strict";
import { test } from "node:test";
import { plain, typeset } from "./typography.ts";

const NNBSP = "\u202F";
const NBSP = "\u00A0";
const fr = (body: string) => typeset(`<html lang="fr"><body>${body}</body></html>`).replace(/^<html lang="fr"><body>|<\/body><\/html>$/g, "");
const en = (body: string) => typeset(`<html lang="en"><body>${body}</body></html>`).replace(/^<html lang="en"><body>|<\/body><\/html>$/g, "");

test("French: a narrow no-break space before ; ! ? and %, a no-break space before : and inside « »", () => {
  assert.equal(fr("<p>Vraiment ? Oui ; non ! Ici : 96,13 %</p>"), `<p>Vraiment${NNBSP}? Oui${NNBSP}; non${NNBSP}! Ici${NBSP}: 96,13${NNBSP}%</p>`);
  assert.equal(fr("<p>Vraiment?</p>"), `<p>Vraiment${NNBSP}?</p>`);
  assert.equal(fr("<p>« high »</p>"), `<p>«${NBSP}high${NBSP}»</p>`);
  assert.equal(fr("<p>3,29–4,75 $</p>"), `<p>3,29–4,75${NBSP}$</p>`);
  // Across an inline element: the space before the mark is the text's own.
  assert.equal(fr("<p><a>lien</a> ?</p>"), `<p><a>lien</a>${NNBSP}?</p>`);
});

test("French: curly apostrophes; times, URLs and entities are left alone", () => {
  assert.equal(fr("<p>l'adresse d'un run</p>"), "<p>l’adresse d’un run</p>");
  assert.equal(fr("<p>entre 02:00 et 06:00, https://matteogallo.ch, R&amp;D</p>"), "<p>entre 02:00 et 06:00, https://matteogallo.ch, R&amp;D</p>");
  assert.equal(fr("<p>a &lt; b ?</p>"), `<p>a &lt; b${NNBSP}?</p>`);
});

test("French in monospace: the no-break space, since the mono subset has no U+202F", () => {
  assert.equal(fr('<span class="value mono">96,13 %</span>'), `<span class="value mono">96,13${NBSP}%</span>`);
});

test("English: curly quotes and apostrophes, opening and closing by position", () => {
  assert.equal(en(`<p>Cohen's kappa, a "low" robustness, the users' view</p>`), "<p>Cohen’s kappa, a “low” robustness, the users’ view</p>");
  assert.equal(en(`<p>a risk <em>"high"</em>.</p>`), "<p>a risk <em>“high”</em>.</p>");
  assert.equal(en(`<p>"Quoted," she said.</p>`), "<p>“Quoted,” she said.</p>");
  assert.equal(en("<p>Is it? Yes: 96.13%</p>"), "<p>Is it? Yes: 96.13%</p>");
});

test("the language of an element wins over the page's", () => {
  assert.equal(fr(`<p>Citation : <q lang="en">it's "fine"</q> ?</p>`), `<p>Citation${NBSP}: <q lang="en">it’s “fine”</q>${NNBSP}?</p>`);
  assert.equal(en(`<p>He said <span lang="fr">l'adresse ?</span></p>`), `<p>He said <span lang="fr">l’adresse${NNBSP}?</span></p>`);
});

test("code, scripts, styles and verbatim quotes of a run are not touched", () => {
  const kept = `<code>a ? b : c 'x'</code><pre>if (x) { y; }</pre><script>a ? "b" : 'c';</script><style>a::after{content:"?"}</style><p data-verbatim>I don't know ?</p>`;
  assert.equal(fr(kept), kept);
  assert.equal(en(`<p data-verbatim>I don't <b>"know"</b></p><p>don't</p>`), `<p data-verbatim>I don't <b>"know"</b></p><p>don’t</p>`);
});

test("attributes people read are typeset; others are not", () => {
  assert.equal(
    fr(`<img alt="Page d'un rapport : risque « high »" src="/a'b.png"><a href="/x?y=1" aria-label="Quoi ?">x</a>`),
    `<img alt="Page d’un rapport${NBSP}: risque «${NBSP}high${NBSP}»" src="/a'b.png"><a href="/x?y=1" aria-label="Quoi${NNBSP}?">x</a>`,
  );
  assert.equal(en(`<meta name="description" content="Cohen&#39;s &quot;kappa&quot;"><meta property="og:url" content="https://a/b'c">`), `<meta name="description" content="Cohen’s “kappa”"><meta property="og:url" content="https://a/b'c">`);
});

test("typesetting twice changes nothing more", () => {
  const once = fr("<p>Vraiment ? « oui » : 18–46 %</p>");
  assert.equal(fr(once), once);
  const onceEn = en(`<p>"it's" fine</p>`);
  assert.equal(en(onceEn), onceEn);
});

test("plain() reads a typeset text back as its source", () => {
  assert.equal(plain(fr("<p>l'adresse ? « oui » : 18–46 %</p>")), "<p>l'adresse ? « oui » : 18–46 %</p>");
  assert.equal(plain(en(`<p>Cohen's "kappa"</p>`)), `<p>Cohen's "kappa"</p>`);
});
