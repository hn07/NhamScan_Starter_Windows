(() => {
const $ = s => document.querySelector(s);
const state = { pages: [], active: -1, stream: null };
const preview = $("#preview"), ctx = preview.getContext("2d");
let toastTimer;
function toast(message){const el=$("#toast");el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,2600)}
function status(message){$("#status").textContent=message}
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
function addCanvas(canvas,name="Trang"){
 state.pages.push({canvas,filter:"color",name});state.active=state.pages.length-1;
}
function imageToCanvas(file){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const scale=Math.min(1,2200/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement("canvas");c.width=Math.round(img.naturalWidth*scale);c.height=Math.round(img.naturalHeight*scale);c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);resolve(c)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Không đọc được ảnh"))};img.src=url})}
async function importFiles(files){const images=[...files].filter(f=>f.type.startsWith("image/"));if(!images.length)return;status("Đang thêm ảnh…");let added=0;for(const f of images){try{addCanvas(await imageToCanvas(f),f.name);added++}catch(e){console.error(e)}}refreshWorkspace();status("Đã thêm "+added+" trang");toast("Đã thêm "+added+" trang")}
$("#fileInput").onchange=e=>{importFiles(e.target.files);e.target.value=""};
$("#addInput").onchange=e=>{importFiles(e.target.files);e.target.value=""};
$("#prevPage").onclick=()=>showPage(state.active-1);$("#nextPage").onclick=()=>showPage(state.active+1);
$("#filter").onchange=()=>{const p=state.pages[state.active];if(p){p.filter=$("#filter").value;showPage(state.active)}};
function rotate(degrees){const p=state.pages[state.active];if(!p)return;const old=p.canvas,swap=Math.abs(degrees)%180===90,c=document.createElement("canvas");c.width=swap?old.height:old.width;c.height=swap?old.width:old.height;const x=c.getContext("2d");x.translate(c.width/2,c.height/2);x.rotate(degrees*Math.PI/180);x.drawImage(old,-old.width/2,-old.height/2);p.canvas=c;showPage(state.active)}
$("#rotateLeft").onclick=()=>rotate(-90);$("#rotateRight").onclick=()=>rotate(90);
$("#deletePage").onclick=()=>{if(state.active<0)return;state.pages.splice(state.active,1);state.active=Math.min(state.active,state.pages.length-1);refreshWorkspace();status("Đã xóa trang");toast("Đã xóa trang")};
async function openCamera(){
 try{if(!navigator.mediaDevices?.getUserMedia)throw new Error("Trình duyệt không hỗ trợ camera");state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});$("#video").srcObject=state.stream;$("#cameraCount").textContent="Đã chụp "+state.pages.length+" trang";$("#cameraModal").hidden=false;await $("#video").play().catch(()=>{});}
 catch(e){console.error(e);toast("Không mở được camera. Chạy qua http://localhost:8080 và cho phép quyền camera.")}
}
function closeCamera(){if(state.stream){state.stream.getTracks().forEach(t=>t.stop());state.stream=null}$("#video").srcObject=null;$("#cameraModal").hidden=true}
$("#cameraBtn").onclick=openCamera;
$("#closeCamera").onclick=()=>{closeCamera();if(state.pages.length)refreshWorkspace()};
$("#takePhoto").onclick=()=>{
 const video=$("#video");if(!video.videoWidth){toast("Camera đang khởi động, vui lòng thử lại");return}
 const c=document.createElement("canvas");c.width=video.videoWidth;c.height=video.videoHeight;c.getContext("2d").drawImage(video,0,0,c.width,c.height);
 addCanvas(c,"Camera "+state.pages.length);$("#cameraCount").textContent="Đã chụp "+state.pages.length+" trang";
 status("Đã chụp "+state.pages.length+" trang");refreshWorkspace();$("#cameraModal").hidden=false;
 toast("Đã chụp trang "+state.pages.length+" — tiếp tục chụp trang kế tiếp");
};
$("#finishCamera").onclick=()=>{closeCamera();refreshWorkspace();status("Đã hoàn tất "+state.pages.length+" trang");toast(state.pages.length?"Đã giữ lại "+state.pages.length+" trang":"Chưa có trang nào được chụp")};
$("#savePdf").onclick=async()=>{
 if(!state.pages.length)return;
 try{if(!window.jspdf?.jsPDF)throw new Error("Không tải được thư viện PDF. Kiểm tra kết nối Internet.");status("Đang tạo PDF…");$("#savePdf").disabled=true;
 const {jsPDF}=window.jspdf;let pdf;
 for(let i=0;i<state.pages.length;i++){const c=filteredCanvas(state.pages[i]),orientation=c.width>c.height?"landscape":"portrait";if(!pdf)pdf=new jsPDF({orientation,unit:"pt",format:[c.width,c.height],compress:true});else pdf.addPage([c.width,c.height],orientation);pdf.addImage(c.toDataURL("image/jpeg",.93),"JPEG",0,0,c.width,c.height,undefined,"FAST");}
 let name=($("#docName").value.trim()||"Tai_lieu_scan").replace(/[\\/:*?"<>|]/g,"_");if(!name.toLowerCase().endsWith(".pdf"))name+=".pdf";pdf.save(name);status("Đã lưu PDF gồm "+state.pages.length+" trang");toast("Đã lưu "+name+" ("+state.pages.length+" trang)");
 }catch(e){console.error(e);status("Không thể tạo PDF");toast(e.message||"Lỗi xuất PDF")}finally{$("#savePdf").disabled=!state.pages.length}
};
$("#helpBtn").onclick=()=>$("#helpModal").hidden=false;
$("#closeHelp").onclick=$("#closeHelp2").onclick=()=>$("#helpModal").hidden=true;
window.addEventListener("beforeunload",()=>{if(state.stream)state.stream.getTracks().forEach(t=>t.stop())});
})();