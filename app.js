(() => {
const $ = s => document.querySelector(s);
const state = { pages: [], active: -1, stream: null };
const preview = $("#preview"), ctx = preview.getContext("2d");
let toastTimer;
let cvReadyPromise;
function toast(message){const el=$("#toast");el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,2600)}
function status(message){$("#status").textContent=message}
function waitForOpenCV(timeout=15000){
 if(window.cv && window.cv.Mat && window.cv.findContours)return Promise.resolve(true);
 if(cvReadyPromise)return cvReadyPromise;
 cvReadyPromise=new Promise(resolve=>{
  const started=Date.now();
  const check=()=>{if(window.cv&&window.cv.Mat&&window.cv.findContours)resolve(true);else if(Date.now()-started>timeout)resolve(false);else setTimeout(check,100)};
  check();
 });
 return cvReadyPromise;
}
function orderCorners(points){
 const sum=p=>p.x+p.y,diff=p=>p.y-p.x;
 return [points.reduce((a,b)=>sum(a)<sum(b)?a:b),points.reduce((a,b)=>diff(a)<diff(b)?a:b),points.reduce((a,b)=>sum(a)>sum(b)?a:b),points.reduce((a,b)=>diff(a)>diff(b)?a:b)];
}
async function autoCropDocument(inputCanvas){
 // Keep image sizes practical for mobile browsers while retaining scan quality.
 // Preserve the full input resolution; only the detection copy is reduced.
 const source=document.createElement("canvas");source.width=inputCanvas.width;source.height=inputCanvas.height;
 source.getContext("2d",{willReadFrequently:true}).drawImage(inputCanvas,0,0);
 const ready=await waitForOpenCV();
 if(!ready)return {canvas:source,cropped:false,reason:"Không tải được bộ nhận diện mép giấy"};
 let src,small,gray,blur,edges,contours,hierarchy,kernel;
 try{
  src=cv.imread(source);
  const detectScale=Math.min(1,1000/Math.max(source.width,source.height));
  small=new cv.Mat();cv.resize(src,small,new cv.Size(Math.round(src.cols*detectScale),Math.round(src.rows*detectScale)));
  gray=new cv.Mat();blur=new cv.Mat();edges=new cv.Mat();contours=new cv.MatVector();hierarchy=new cv.Mat();
  cv.cvtColor(small,gray,cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray,blur,new cv.Size(5,5),0);
  // Try several edge/threshold strategies: paper edges may be faint or unevenly lit.
  let best=null,bestArea=0;
  const findCandidates=(mask,epsilonFactor)=>{
   const found=new cv.MatVector(),hier=new cv.Mat();
   cv.findContours(mask,found,hier,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
   for(let i=0;i<found.size();i++){
    const contour=found.get(i),per=cv.arcLength(contour,true),approx=new cv.Mat();
    cv.approxPolyDP(contour,approx,epsilonFactor*per,true);
    const area=Math.abs(cv.contourArea(approx));
    if(approx.rows===4&&cv.isContourConvex(approx)&&area>small.cols*small.rows*.15&&area>bestArea){
     const pts=[];for(let j=0;j<4;j++)pts.push({x:approx.data32S[j*2]/detectScale,y:approx.data32S[j*2+1]/detectScale});
     // Reject implausible shapes and candidates touching almost the entire image frame.
     const ordered=orderCorners(pts),[a,b,d,e]=ordered;
     const w=Math.max(Math.hypot(a.x-b.x,a.y-b.y),Math.hypot(e.x-d.x,e.y-d.y));
     const h=Math.max(Math.hypot(a.x-e.x,a.y-e.y),Math.hypot(b.x-d.x,b.y-d.y));
     const ratio=w/Math.max(1,h),frameRatio=area/(small.cols*small.rows);
     if(ratio>.35&&ratio<1.8&&frameRatio<.97){best=pts;bestArea=area}
    }
    contour.delete();approx.delete();
   }
   found.delete();hier.delete();
  };
  cv.Canny(blur,edges,35,110);
  kernel=cv.getStructuringElement(cv.MORPH_RECT,new cv.Size(5,5));
  cv.morphologyEx(edges,edges,cv.MORPH_CLOSE,kernel);
  findCandidates(edges,.018);
  // Threshold contours help when paper and background have clear brightness contrast.
  const thresh=new cv.Mat();
  cv.threshold(blur,thresh,0,255,cv.THRESH_BINARY+cv.THRESH_OTSU);
  findCandidates(thresh,.018);
  cv.bitwise_not(thresh,thresh);
  findCandidates(thresh,.018);
  thresh.delete();
  if(!best)return {canvas:source,cropped:false,reason:"Chưa nhận diện rõ bốn mép giấy"};
  const [tl,tr,br,bl]=orderCorners(best);
  const dist=(p1,p2)=>Math.hypot(p1.x-p2.x,p1.y-p2.y);
  const width=Math.round(Math.max(dist(tl,tr),dist(bl,br))),height=Math.round(Math.max(dist(tl,bl),dist(tr,br)));
  if(width<100||height<100)return {canvas:source,cropped:false,reason:"Vùng giấy nhận diện quá nhỏ"};
  const from=cv.matFromArray(4,1,cv.CV_32FC2,[tl.x,tl.y,tr.x,tr.y,br.x,br.y,bl.x,bl.y]);
  const to=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,width-1,0,width-1,height-1,0,height-1]);
  const transform=cv.getPerspectiveTransform(from,to),out=new cv.Mat();
  cv.warpPerspective(src,out,transform,new cv.Size(width,height),cv.INTER_CUBIC,cv.BORDER_REPLICATE,new cv.Scalar());
  const result=document.createElement("canvas");result.width=out.cols;result.height=out.rows;cv.imshow(result,out);
  from.delete();to.delete();transform.delete();out.delete();
  return {canvas:result,cropped:true};
 }catch(err){console.warn("Auto-crop failed",err);return {canvas:source,cropped:false,reason:"Không thể tự cắt mép giấy"}}
 finally{[src,small,gray,blur,edges,contours,hierarchy,kernel].forEach(m=>{try{if(m)m.delete()}catch(_){}})}
}

// Manual four-corner crop editor. Coordinates are stored in full-resolution source pixels.
let cropPage=null,cropPoints=[],dragPoint=-1,cropDisplay={scale:1,ox:0,oy:0,w:0,h:0};
const cropCanvas=$("#cropCanvas"),cropCtx=cropCanvas.getContext("2d");
function drawCropEditor(){
 if(!cropPage)return;
 const src=cropPage.originalCanvas||cropPage.canvas,stage=$("#cropStage");
 const rect=stage.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
 const maxW=Math.max(220,rect.width-16),maxH=Math.max(260,window.innerHeight*.55);
 const scale=Math.min(maxW/src.width,maxH/src.height,1);
 const w=Math.round(src.width*scale),h=Math.round(src.height*scale);
 cropCanvas.width=Math.round(w*dpr);cropCanvas.height=Math.round(h*dpr);
 cropCanvas.style.width=w+"px";cropCanvas.style.height=h+"px";
 cropCtx.setTransform(dpr,0,0,dpr,0,0);cropCtx.clearRect(0,0,w,h);cropCtx.drawImage(src,0,0,w,h);
 cropDisplay={scale,ox:0,oy:0,w,h};
 cropCtx.save();cropCtx.strokeStyle="#10d6b0";cropCtx.lineWidth=3;cropCtx.fillStyle="#07111caa";
 cropCtx.beginPath();cropPoints.forEach((p,i)=>{const x=p.x*scale,y=p.y*scale;i?cropCtx.lineTo(x,y):cropCtx.moveTo(x,y)});cropCtx.closePath();cropCtx.stroke();
 cropCtx.beginPath();cropCtx.moveTo(0,0);cropCtx.lineTo(w,0);cropCtx.lineTo(w,h);cropCtx.lineTo(0,h);cropCtx.closePath();
 cropCtx.moveTo(cropPoints[0].x*scale,cropPoints[0].y*scale);cropPoints.forEach(p=>cropCtx.lineTo(p.x*scale,p.y*scale));cropCtx.closePath();cropCtx.fill("evenodd");
 cropPoints.forEach((p,i)=>{const x=p.x*scale,y=p.y*scale;cropCtx.beginPath();cropCtx.arc(x,y,10,0,Math.PI*2);cropCtx.fillStyle="#ffffff";cropCtx.fill();cropCtx.lineWidth=3;cropCtx.strokeStyle="#059e87";cropCtx.stroke();cropCtx.fillStyle="#102030";cropCtx.font="bold 11px sans-serif";cropCtx.textAlign="center";cropCtx.textBaseline="middle";cropCtx.fillText(String(i+1),x,y)});
 cropCtx.restore();
}
function openManualCrop(){
 const p=state.pages[state.active];if(!p)return;
 cropPage=p;const src=p.originalCanvas||p.canvas;
 cropPoints=[{x:0,y:0},{x:src.width-1,y:0},{x:src.width-1,y:src.height-1},{x:0,y:src.height-1}];
 $("#cropModal").hidden=false;requestAnimationFrame(drawCropEditor);
}
function cropPointer(e){
 if(!cropPage)return;const r=cropCanvas.getBoundingClientRect(),x=(e.clientX-r.left)/cropDisplay.scale,y=(e.clientY-r.top)/cropDisplay.scale;
 if(e.type==="pointerdown"){
  let nearest=-1,dist=Infinity;cropPoints.forEach((p,i)=>{const d=Math.hypot(p.x-x,p.y-y);if(d<dist){dist=d;nearest=i}});
  if(nearest>=0&&dist<Math.max(28,32/cropDisplay.scale)){dragPoint=nearest;cropCanvas.setPointerCapture(e.pointerId);e.preventDefault()}
 }else if(e.type==="pointermove"&&dragPoint>=0){
  const src=cropPage.originalCanvas||cropPage.canvas;cropPoints[dragPoint]={x:Math.max(0,Math.min(src.width-1,x)),y:Math.max(0,Math.min(src.height-1,y))};drawCropEditor();e.preventDefault()
 }else if(e.type==="pointerup"||e.type==="pointercancel"){dragPoint=-1}
}
cropCanvas.addEventListener("pointerdown",cropPointer);cropCanvas.addEventListener("pointermove",cropPointer);cropCanvas.addEventListener("pointerup",cropPointer);cropCanvas.addEventListener("pointercancel",cropPointer);
$("#manualCrop").onclick=openManualCrop;$("#closeCrop").onclick=()=>{$("#cropModal").hidden=true;cropPage=null};
$("#resetCrop").onclick=()=>{if(!cropPage)return;const s=cropPage.originalCanvas||cropPage.canvas;cropPoints=[{x:0,y:0},{x:s.width-1,y:0},{x:s.width-1,y:s.height-1},{x:0,y:s.height-1}];drawCropEditor()};
$("#applyCrop").onclick=async()=>{
 if(!cropPage)return;
 const ready=await waitForOpenCV();if(!ready){toast("Không tải được thư viện chỉnh phối cảnh");return}
 const [tl,tr,br,bl]=cropPoints,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const w=Math.round(Math.max(dist(tl,tr),dist(bl,br))),h=Math.round(Math.max(dist(tl,bl),dist(tr,br)));
 if(w<80||h<80){toast("Vùng cắt quá nhỏ");return}
 let src,from,to,transform,out;
 try{
  src=cv.imread(cropPage.originalCanvas||cropPage.canvas);
  from=cv.matFromArray(4,1,cv.CV_32FC2,[tl.x,tl.y,tr.x,tr.y,br.x,br.y,bl.x,bl.y]);
  to=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,w-1,0,w-1,h-1,0,h-1]);
  transform=cv.getPerspectiveTransform(from,to);out=new cv.Mat();
  cv.warpPerspective(src,out,transform,new cv.Size(w,h),cv.INTER_CUBIC,cv.BORDER_REPLICATE,new cv.Scalar());
  const result=document.createElement("canvas");result.width=out.cols;result.height=out.rows;cv.imshow(result,out);
  cropPage.canvas=result;cropPage.originalCanvas=result;$("#cropModal").hidden=true;cropPage=null;refreshWorkspace();toast("Đã áp dụng vùng cắt thủ công");
 }catch(err){console.error(err);toast("Không thể áp dụng vùng cắt")}
 finally{[src,from,to,transform,out].forEach(m=>{try{if(m)m.delete()}catch(_){}})}
};
window.addEventListener("resize",()=>{if(!$("#cropModal").hidden)drawCropEditor()});
function filteredCanvas(page){
 const source=page.canvas, c=document.createElement("canvas");c.width=source.width;c.height=source.height;
 const x=c.getContext("2d"), filter=page.filter||"color";
 if(filter==="gray"||filter==="bw")x.filter="grayscale(1)";
 if(filter==="enhance")x.filter="contrast(1.18) saturate(1.08)";
 x.drawImage(source,0,0);x.filter="none";
 if(filter==="bw"){const im=x.getImageData(0,0,c.width,c.height),d=im.data;for(let i=0;i<d.length;i+=4){const v=(d[i]*.299+d[i+1]*.587+d[i+2]*.114)>170?255:0;d[i]=d[i+1]=d[i+2]=v}x.putImageData(im,0,0)}
 return c;
}
function renderPages(){
 $("#pageCount").textContent=state.pages.length+" trang";
 const list=$("#pageList");list.innerHTML="";
 if(!state.pages.length){list.innerHTML='<p class="muted">Chưa có trang nào.</p>';return}
 state.pages.forEach((p,i)=>{const b=document.createElement("button");b.className="page-thumb"+(i===state.active?" active":"");b.innerHTML='<img alt="Trang '+(i+1)+'"><span>Trang '+(i+1)+'</span>';b.querySelector("img").src=p.canvas.toDataURL("image/jpeg",.75);b.onclick=()=>showPage(i);list.appendChild(b)});
}
function showPage(i){
 if(i<0||i>=state.pages.length)return;
 state.active=i;const p=state.pages[i],c=filteredCanvas(p);preview.width=c.width;preview.height=c.height;ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(c,0,0);
 $("#pageLabel").textContent="Trang "+(i+1)+" / "+state.pages.length;$("#imageSize").textContent=p.canvas.width+" × "+p.canvas.height+" px";$("#filter").value=p.filter||"color";renderPages();
}
function refreshWorkspace(){
 const has=state.pages.length>0;$("#welcome").hidden=has;$("#workspace").hidden=!has;$("#savePdf").disabled=!has;
 if(has)showPage(Math.max(0,state.active));else renderPages();
}
function addCanvas(canvas,name="Trang",originalCanvas=canvas){
 state.pages.push({canvas,originalCanvas,filter:"color",name});state.active=state.pages.length-1;
}
function imageToCanvas(file){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);resolve(c)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Không đọc được ảnh"))};img.src=url})}
async function importFiles(files){const images=[...files].filter(f=>f.type.startsWith("image/"));if(!images.length)return;status("Đang thêm ảnh…");let added=0;for(const f of images){try{const original=await imageToCanvas(f),result=await autoCropDocument(original);addCanvas(result.canvas,f.name,original);added++;if(!result.cropped)console.info(result.reason)}catch(e){console.error(e)}}refreshWorkspace();status("Đã thêm "+added+" trang");toast("Đã thêm "+added+" trang")}
$("#fileInput").onchange=e=>{importFiles(e.target.files);e.target.value=""};
$("#addInput").onchange=e=>{importFiles(e.target.files);e.target.value=""};
$("#prevPage").onclick=()=>showPage(state.active-1);$("#nextPage").onclick=()=>showPage(state.active+1);
$("#filter").onchange=()=>{const p=state.pages[state.active];if(p){p.filter=$("#filter").value;showPage(state.active)}};
function rotate(degrees){const p=state.pages[state.active];if(!p)return;const old=p.canvas,swap=Math.abs(degrees)%180===90,c=document.createElement("canvas");c.width=swap?old.height:old.width;c.height=swap?old.width:old.height;const x=c.getContext("2d");x.translate(c.width/2,c.height/2);x.rotate(degrees*Math.PI/180);x.drawImage(old,-old.width/2,-old.height/2);p.canvas=c;showPage(state.active)}
$("#rotateLeft").onclick=()=>rotate(-90);$("#rotateRight").onclick=()=>rotate(90);
$("#deletePage").onclick=()=>{if(state.active<0)return;state.pages.splice(state.active,1);state.active=Math.min(state.active,state.pages.length-1);refreshWorkspace();status("Đã xóa trang");toast("Đã xóa trang")};
async function openCamera(){
 try{if(!navigator.mediaDevices?.getUserMedia)throw new Error("Trình duyệt không hỗ trợ camera");state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:3840},height:{ideal:2160},frameRate:{ideal:30,max:30}},audio:false});$("#video").srcObject=state.stream;$("#cameraCount").textContent="Đã chụp "+state.pages.length+" trang";$("#cameraModal").hidden=false;await $("#video").play().catch(()=>{});}
 catch(e){console.error(e);toast("Không mở được camera. Chạy qua http://localhost:8080 và cho phép quyền camera.")}
}
function closeCamera(){if(state.stream){state.stream.getTracks().forEach(t=>t.stop());state.stream=null}$("#video").srcObject=null;$("#cameraModal").hidden=true}
$("#cameraBtn").onclick=openCamera;
$("#closeCamera").onclick=()=>{closeCamera();if(state.pages.length)refreshWorkspace()};
$("#takePhoto").onclick=async()=>{
 const video=$("#video");if(!video.videoWidth){toast("Camera đang khởi động, vui lòng thử lại");return}
 const c=document.createElement("canvas");c.width=video.videoWidth;c.height=video.videoHeight;c.getContext("2d").drawImage(video,0,0,c.width,c.height);
 $("#takePhoto").disabled=true;$("#takePhoto").textContent="Đang căn mép giấy…";
 const result=await autoCropDocument(c);addCanvas(result.canvas,"Camera "+state.pages.length,c);$("#takePhoto").disabled=false;$("#takePhoto").textContent="◎ Chụp trang";$("#cameraCount").textContent="Đã chụp "+state.pages.length+" trang";
 status("Đã chụp "+state.pages.length+" trang");refreshWorkspace();$("#cameraModal").hidden=false;
 toast(result.cropped?"Đã tự căn và cắt mép giấy — tiếp tục chụp":"Chưa nhận diện được mép giấy, giữ ảnh gốc — thử đặt giấy trên nền tương phản");
};
$("#finishCamera").onclick=()=>{closeCamera();refreshWorkspace();status("Đã hoàn tất "+state.pages.length+" trang");toast(state.pages.length?"Đã giữ lại "+state.pages.length+" trang":"Chưa có trang nào được chụp")};
function pdfFileName(){let name=($("#docName").value.trim()||"Tai_lieu_scan").replace(/[\\/:*?"<>|]/g,"_");if(!name.toLowerCase().endsWith(".pdf"))name+=".pdf";return name}
async function buildPdfBlob(){
 if(!window.jspdf?.jsPDF)throw new Error("Không tải được thư viện PDF. Kiểm tra kết nối Internet.");
 const {jsPDF}=window.jspdf;let pdf;
 for(let i=0;i<state.pages.length;i++){
  const c=filteredCanvas(state.pages[i]),orientation=c.width>c.height?"landscape":"portrait";
  if(!pdf)pdf=new jsPDF({orientation,unit:"pt",format:"a4",compress:true});
  else pdf.addPage("a4",orientation);
  const pageW=pdf.internal.pageSize.getWidth(),pageH=pdf.internal.pageSize.getHeight(),margin=12;
  const scale=Math.min((pageW-margin*2)/c.width,(pageH-margin*2)/c.height);
  const w=c.width*scale,h=c.height*scale,x=(pageW-w)/2,y=(pageH-h)/2;
  // PNG avoids JPEG re-compression. Keep source canvas at native resolution.
  pdf.addImage(c.toDataURL("image/png"),"PNG",x,y,w,h,undefined,"NONE");
 }
 return pdf.output("blob");
}
$("#savePdf").onclick=async()=>{
 if(!state.pages.length)return;
 try{status("Đang tạo PDF chất lượng cao…");$("#savePdf").disabled=true;
 const blob=await buildPdfBlob(),name=pdfFileName(),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 status("Đã lưu PDF gồm "+state.pages.length+" trang");toast("Đã lưu "+name+" ("+state.pages.length+" trang)");
 }catch(e){console.error(e);status("Không thể tạo PDF");toast(e.message||"Lỗi xuất PDF")}finally{$("#savePdf").disabled=!state.pages.length}
};
$("#sharePdf").onclick=async()=>{
 if(!state.pages.length)return;
 const btn=$("#sharePdf");
 try{
  btn.disabled=true;status("Đang chuẩn bị PDF để chia sẻ…");
  const blob=await buildPdfBlob(),name=pdfFileName();
  const file=new File([blob],name,{type:"application/pdf"});
  if(navigator.canShare&&navigator.canShare({files:[file]})&&navigator.share){
   await navigator.share({files:[file],title:name,text:"Tài liệu được quét bằng NhamScan"});
   status("Đã mở bảng chia sẻ");toast("Chọn Zalo trong bảng chia sẻ để gửi PDF");
  }else{
   const url=URL.createObjectURL(blob),a=document.createElement("a");
   a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   status("Đã tải PDF");toast("Thiết bị chưa hỗ trợ chia sẻ tệp trực tiếp. Mở Zalo và đính kèm PDF vừa tải.");
   window.open("https://zalo.me/","_blank","noopener");
  }
 }catch(e){
  if(e?.name==="AbortError"){status("Đã hủy chia sẻ");}
  else{console.error(e);status("Không thể chia sẻ PDF");toast(e.message||"Không thể chia sẻ PDF")}
 }finally{btn.disabled=!state.pages.length}
};
$("#helpBtn").onclick=()=>$("#helpModal").hidden=false;
$("#closeHelp").onclick=$("#closeHelp2").onclick=()=>$("#helpModal").hidden=true;
window.addEventListener("beforeunload",()=>{if(state.stream)state.stream.getTracks().forEach(t=>t.stop())});
})();