import subprocess,time,urllib.request,json,re,pathlib,concurrent.futures,os
from html.parser import HTMLParser
class Page(HTMLParser):
 def __init__(self):super().__init__();self.h1=0;self.canon=None;self.desc=None;self.links=[];self.schemas=[];self.script=False;self.text=[];self.buf=''
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if tag=='h1':self.h1+=1
  if tag=='link' and d.get('rel')=='canonical':self.canon=d.get('href')
  if tag=='meta' and d.get('name')=='description':self.desc=d.get('content')
  if tag=='a':self.links.append(d.get('href',''))
  if tag=='script' and d.get('type')=='application/ld+json':self.script=True;self.buf=''
 def handle_endtag(self,tag):
  if tag=='script' and self.script:self.schemas.append(json.loads(self.buf));self.script=False
 def handle_data(self,data):
  self.text.append(data)
  if self.script:self.buf+=data
root=pathlib.Path(__file__).resolve().parents[2];app=root/'tax_simba_frontend';env=dict(os.environ,PORT='3102',HOSTNAME='127.0.0.1');log=open('editorial-smoke-server.log','w');p=subprocess.Popen(['node','--import',str(pathlib.Path(__file__).with_name('local-fetch-guard.mjs')),'--env-file=.env.production.local','.next/standalone/server.js'],cwd=app,env=env,stdout=log,stderr=log)
try:
 base='http://127.0.0.1:3102'
 for i in range(75):
  try:urllib.request.urlopen(base+'/robots.txt',timeout=1);break
  except Exception:time.sleep(.2)
 articles=json.loads((root/'release/editorial-v2/ALL_ARTICLES.json').read_text())
 def fetch(path):
  with urllib.request.urlopen(base+path,timeout=40) as r:return r.status,r.read()
 def check(a):
  status,raw=fetch('/blogs/'+a['slug']);page=Page();page.feed(raw.decode());text=' '.join(page.text)
  assert page.h1==1,a['slug']+' H1'
  assert page.canon=='https://taxsimba.co.uk/blogs/'+a['slug']
  assert len(page.desc)<=160
  assert 'Reviewed by TaxSimba' not in text
  assert 'A decision guide for this situation' not in text
  assert 'Two more questions you may have' not in text
  assert a['preparationDownload'] in page.links
  assert page.schemas,a['slug']+' JSON-LD'
  for url in page.links:
   if url.startswith('/downloads/'):assert fetch(url)[0]==200
  # Test every responsive artwork export, not just existence on disk.
  for w in [480,960,1440]:assert fetch('/images/articles/'+a['slug']+'-'+str(w)+'.webp')[0]==200
  return {'rank':a['releaseRank'],'slug':a['slug'],'status':status,'oneH1':True,'canonical':True,'metadata':True,'structuredDataParses':True,'download':True,'responsiveAssets':3,'genericReviewerLabelAbsent':True}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:results=list(ex.map(check,articles))
 checks={}
 for x in ['/blogs','/robots.txt','/sitemap.xml','/register','/register?role=MTD','/pricing','/mtd-information']:
  status,data=fetch(x);checks[x]={'status':status}
  if x=='/sitemap.xml':checks[x]['articleCoverage']=sum('/blogs/'+a['slug'] in data.decode() for a in articles);assert checks[x]['articleCoverage']==120
 out={'articles':results,'routes':checks,'scope':'HTTP/server-rendered validation; no new browser/mobile pass claimed','mobileBrowser':'not rerun: Chromium download unavailable in this environment'}
 (root/'release/editorial-v2/HTTP_RESULTS.json').write_text(json.dumps(out,indent=2));print('PASS',len(results),'article pages,',sum(x['responsiveAssets'] for x in results),'image responses, 120 downloads and 120 sitemap entries');print(checks)
finally:p.terminate();p.wait(timeout=20);log.close()
