let state={
i:0,i:0,
total:0,
review:false,
wrong:[]
};

function getQ(){
return state.review?state.wrong[state.i]:questions[state.i];
}

function show(){
let q=getQ();
document.getElementById("questionText").innerHTML=q.q;

document.getElementById("options").innerHTML=
q.a.map((x,i)=>`<div class="option" onclick="ans(${i},this)">${x}</div>`).join("");
}

function ans(i,el){
let q=getQ();

document.querySelectorAll(".option").forEach(b=>b.classList.remove("selected"));
el.classList.add("selected");

state.total++;

if(i===q.correct){
el.classList.add("correct");
state.correct++;

if(state.review){
state.wrong=state.wrong.filter(x=>x!==q);
}
}else{
if(!state.review) state.wrong.push(q);
}

update();
}

function next(){
state.i++;

if(state.review){
if(state.i>=state.wrong.length){
alert("復習終了");
state.review=false;
state.i=0;
}
}else{
if(state.i>=questions.length){
alert("終了");
state.i=0;
}
}
show();
}

function startExam(){
state.review=false;
state.i=0;
show();
}

function startReview(){
if(state.wrong.length===0){
alert("なし");
return;
}
state.review=true;
state.i=0;
show();
}

function update(){
document.getElementById("correctCnt").innerText=state.correct;
document.getElementById("totalCnt").innerText=state.total;
}

/* ===== メモ（見やすく修正済） ===== */
let canvas=document.getElementById("memo");
let ctx=canvas.getContext("2d");

canvas.width=400;
canvas.height=400;

ctx.strokeStyle="#000";
ctx.lineWidth=3;

let drawing=false;

canvas.onmousedown=e=>{
drawing=true;
ctx.beginPath();
ctx.moveTo(e.offsetX,e.offsetY);
};

canvas.onmousemove=e=>{
if(!drawing) return;
ctx.lineTo(e.offsetX,e.offsetY);
ctx.stroke();
};

canvas.onmouseup=()=>drawing=false;

/* 初期 */
show();
