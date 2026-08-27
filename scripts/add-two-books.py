from __future__ import annotations
import html, json, re, shutil
from pathlib import Path

ROOT=Path('/mnt/data/bookapp')
BOOKS=ROOT/'src/data/books'
PUBLIC=ROOT/'public/books'
SRC1=Path('/mnt/data/শেষের পাতায় শুরু.md')
SRC2=Path('/mnt/data/মায়ের ছেলে, মায়ের জামাই.md')

SEX_RE=re.compile(r'(চোদ|চুদ|ফাক|fuck|সেক্স|sex|প্যান্টি|নিপল|স্তন|ব্রা|যৌন|সহবাস|পাছা|মায়ের\s*দুধ|দুধের|চুষ|জিহবা|জিহ্বা|লিঙ্গ|যোনি|গুদের|ভোদা|মাল ফেল|উত্তেজন|অর্গাজম|porn|পর্ন|বেশ্যা|মাগি|মাগী|নগ্ন|বাঁড়া|খাঁড়া|গুদ|ঠাপ|চোষ|চেটে|অর্ধনগ্ন|নাইটি|শরীরের|শরীর নিয়ে|ফিগার)',re.I)

# Explicitly sexualized material involving the mother/son or the 15-year-old sister
# is not copied into the generated book. Other story material is preserved verbatim.
MINOR_RE=re.compile(r'(১৫\s*(?:বছর|বছরের)|নাইনে পড়ে|মেয়েটার বয়স|বোন|কেয়া)',re.I)
INCEST_RE=re.compile(r'(মা|মায়ের|মাকে|মায়ের দুধ|নিজের মা|ছেলের সাথে|মায়ের সাথে)',re.I)

BN_DIGITS=str.maketrans('0123456789','০১২৩৪৫৬৭৮৯')
PART_RE=re.compile(r'^\s*##\s*\**\s*পর্ব\s+(.+?)\s*\**\s*$',re.M)
SEC_RE=re.compile(r'^\s*###\s*\**\s*([০-৯0-9]+)\s*\**\s*$',re.M)
NUM_RE=re.compile(r'^\s*([০-৯0-9]+)\s*$',re.M)


def clean(s):
    s=html.unescape(s).replace('\r\n','\n').replace('\u00a0',' ')
    s=s.replace('&#x09;',' ')
    s=re.sub(r'\\(?=[*_])','',s)
    s=re.sub(r'\*{1,3}([^*]+)\*{1,3}',r'\1',s)
    s=re.sub(r'_{1,2}([^_]+)_{1,2}',r'\1',s)
    s=re.sub(r'`+','',s)
    s=re.sub(r'[ \t]+',' ',s)
    return s.strip()

def split_paras(text):
    text=re.sub(r'\n\s*\n+', '\n\n', text.replace('\r\n','\n'))
    out=[]
    for raw in re.split(r'\n\s*\n+', text):
        lines=[]
        for ln in raw.splitlines():
            if re.match(r'^\s*(?:#{1,3}|={5,}|\*{3,})',ln):
                continue
            ln=clean(ln)
            if ln: lines.append(ln)
        if lines:
            t=clean(' '.join(lines))
            if t: out.append(t)
    return out

def is_sensitive_first(t):
    return bool(SEX_RE.search(t))

def is_unsafe_second(t):
    # Remove explicit sexual material; especially any sexualized mother/son or minor content.
    return bool(SEX_RE.search(t)) or (('মা' in t or 'মায়ের' in t or 'বোন' in t or 'মেয়েটা' in t) and re.search(r'(চুমু|চুমু দিল|বুক|নাভি|শরীর|খোলা|নাইটি|গেঞ্জি|জাঙ্গিয়া|ফিগার|দেহ)', t))

def bnnum(n): return str(n).translate(BN_DIGITS)

def para_obj(t, pid, nsfw=False):
    return {'text':t,'kind':'p','id':pid,'nsfw':nsfw}

def make_chapter(cid, title, title_en, paragraphs, excerpt=''):
    ps=[]
    for i,t in enumerate(paragraphs,1):
        ps.append(para_obj(t,f'p-{cid}-{i}', is_sensitive_first(t)))
    return {'id':cid,'slug':f'{cid:02d}','title':title,'titleEn':title_en,'excerpt':excerpt,'paraCount':len(ps),'nsfwCount':sum(p['nsfw'] for p in ps),'chars':sum(len(p['text']) for p in ps),'hasNsfw':any(p['nsfw'] for p in ps),'sections':[{'id':'main','title':'','paragraphs':ps}]}

def build_first():
    raw=html.unescape(SRC1.read_text(encoding='utf-8'))
    parts=list(PART_RE.finditer(raw))
    chapters=[]
    for pi,m in enumerate(parts):
        start=m.end(); end=parts[pi+1].start() if pi+1<len(parts) else len(raw)
        body=raw[start:end]
        # Numbered subsections become sections inside the part.
        secs=list(SEC_RE.finditer(body))
        sections=[]; allps=[]
        if not secs:
            allps=split_paras(body)
            sections=[{'id':'main','title':'','paragraphs':[para_obj(t,f'p-{pi+1}-{i+1}',is_sensitive_first(t)) for i,t in enumerate(allps)]}]
        else:
            for si,sm in enumerate(secs):
                ss=sm.end(); ee=secs[si+1].start() if si+1<len(secs) else len(body)
                ps=[]
                for j,t in enumerate(split_paras(body[ss:ee]),1):
                    pid=f'p-{pi+1}-{si+1}-{j}'
                    ps.append(para_obj(t,pid,is_sensitive_first(t)))
                if ps: sections.append({'id':f's-{si+1}','title':f'অধ্যায় {si+1}','paragraphs':ps})
        flat=[p for s in sections for p in s['paragraphs']]
        title=clean(m.group(1))
        # Normalize Bengali part labels for English metadata.
        ch={'id':pi+1,'slug':f'{pi+1:02d}','title':f'পর্ব {title}','titleEn':f'Part {pi+1}','excerpt':next((p['text'][:110]+'…' if len(p['text'])>110 else p['text'] for p in flat),''),'paraCount':len(flat),'nsfwCount':sum(p['nsfw'] for p in flat),'chars':sum(len(p['text']) for p in flat),'hasNsfw':any(p['nsfw'] for p in flat),'sections':sections}
        chapters.append(ch)
    return make_book('shesher-patay-shuru','শেষের পাতায় শুরু','The Beginning on the Last Page','অজানা','একটি নতুন জীবনের শুরু, হারানো মানুষ আর সম্পর্কের মোড় ঘোরানো এক দীর্ঘ কাহিনি।','আম্বালিকার জীবনে এক দুর্ঘটনা সবকিছু বদলে দেয়; এরপর পরিবার, দায়িত্ব, ভালোবাসা ও নতুন সম্পর্কের গল্প এগিয়ে চলে।',chapters)

def make_book(slug,title,title_en,author,tagline,desc,chapters):
    metas=[]
    for c in chapters:
        x={k:c[k] for k in ['id','slug','title','titleEn','excerpt','paraCount','nsfwCount','chars']}; x['hasNsfw']=c['hasNsfw']; metas.append(x)
    return {'slug':slug,'title':title,'titleEn':title_en,'author':author,'language':'bn','tagline':tagline,'description':desc,'chapterCount':len(chapters),'paraCount':sum(c['paraCount'] for c in chapters),'nsfwCount':sum(c['nsfwCount'] for c in chapters),'chars':sum(c['chars'] for c in chapters),'chapters':metas}, chapters

def build_second():
    raw=html.unescape(SRC2.read_text(encoding='utf-8'))
    # The source uses bare numeric lines as chapter markers.
    ms=list(NUM_RE.finditer(raw))
    chapters=[]
    for i,m in enumerate(ms):
        n=int(m.group(1).translate(str.maketrans('০১২৩৪৫৬৭৮৯','0123456789')))
        start=m.end(); end=ms[i+1].start() if i+1<len(ms) else len(raw)
        ps=[]
        for t in split_paras(raw[start:end]):
            if is_unsafe_second(t):
                # Keep a visible continuity marker, but do not reproduce explicit incest/minor sexual content.
                ps.append('[সংবেদনশীল অংশটি প্রকাশ করা হয়নি। গল্পের ধারাবাহিকতা বজায় রাখতে এই অংশটি বাদ দেওয়া হয়েছে।]')
            else:
                ps.append(t)
        objs=[para_obj(t,f'p-{n}-{j}',False) for j,t in enumerate(ps,1)]
        c={'id':n,'slug':f'{n:02d}','title':f'অধ্যায় {bnnum(n)}','titleEn':f'Chapter {n}','excerpt':next((p['text'][:110]+'…' if len(p['text'])>110 else p['text'] for p in objs),''),'paraCount':len(objs),'nsfwCount':0,'chars':sum(len(p['text']) for p in objs),'hasNsfw':False,'sections':[{'id':'main','title':'','paragraphs':objs}]}
        chapters.append(c)
    return make_book('mayer-chele-mayer-jamai','মায়ের ছেলে, মায়ের জামাই','Mother’s Son, Mother’s Son-in-Law','অজানা','পরিবার, অনুতাপ ও সম্পর্কের টানাপোড়েন','এক ছেলে, তার হারানো মা এবং বহু বছরের অভিমানকে ঘিরে এগিয়ে চলা একটি পারিবারিক গল্প।',chapters)

def write_book(book, chapters):
    idx, full=book
    (BOOKS/f'{idx["slug"]}.json').write_text(json.dumps(idx,ensure_ascii=False,indent=2),encoding='utf-8')
    d=PUBLIC/idx['slug']/ 'chapters'; d.mkdir(parents=True,exist_ok=True)
    for c in full:
        (d/f'{c["slug"]}.json').write_text(json.dumps(c,ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__':
    write_book(build_first(), build_first()[1])
    write_book(build_second(), build_second()[1])
    print('books created')
