import { useState } from "react";

const T = {
  saffron:"#E8821A",saffronB:"#D4700F",saffronL:"#FFF4E6",
  teal:"#1A8A72",tealL:"#E6F5F1",amber:"#F5A623",amberL:"#FFF8E6",
  ink:"#2C2416",ink2:"#5C4A32",muted:"#8B7355",border:"#E8DDD0",border2:"#C8B89A",
  bg:"#FAFAF7",surface:"#FFFFFF",panel:"#F5F0E8",
  plum:"#7C3D8F",plumL:"#F5EDF8",rose:"#C0392B",roseL:"#FEF0EE",
  blue:"#1A5A8A",blueL:"#E6F0F8",green:"#2E7D32",greenL:"#EDF7EE",
};
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Montserrat:wght@400;500;600;700;800;900&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Nunito',sans-serif;}
  h1,h2,h3,h4{font-family:'Montserrat',sans-serif;}
  .svc-card{transition:transform .2s,box-shadow .2s;}
  .svc-card:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(44,36,22,.12)!important;}
  .cta-btn{transition:transform .15s,box-shadow .15s;}
  .cta-btn:hover{transform:translateY(-2px);}
  .ghost-btn{transition:background .15s;}
  .ghost-btn:hover{background:#F5F0E8!important;}
  .modal-overlay{animation:fadeIn .2s ease;}
  .modal-box{animation:slideUp .25s ease;}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
  @media(max-width:600px){
    .svc-grid{grid-template-columns:repeat(2,1fr)!important;}
    .why-grid{grid-template-columns:1fr!important;}
    .trust-bar{flex-direction:column;gap:12px!important;}
  }
`;
const SERVICES=[
  {icon:"\ud83c\udfe0",title:"Property Setup & Onboarding",color:T.saffron,bg:T.saffronL,tagline:"Get started without the hassle",desc:"Our team handles your full onboarding — uploading units, adding tenant profiles, configuring rent amounts, and setting due dates. You'll be live in hours, not days.",includes:["Unit & tenant data entry","Rent configuration","Agreement upload","Test run & verification"],price:"\u20b9999 one-time"},
  {icon:"\ud83d\udcdd",title:"Rent Agreement Drafting",color:T.teal,bg:T.tealL,tagline:"Legally sound, delivered fast",desc:"Get a professionally drafted rent agreement compliant with Indian tenancy laws. Covers all standard and custom clauses tailored to your property.",includes:["Customized clauses","Stamp duty guidance","Digital delivery","1 revision included"],price:"\u20b9499/agreement"},
  {icon:"\ud83d\udcca",title:"Financial Reports",color:T.amber,bg:T.amberL,tagline:"Know your numbers clearly",desc:"Monthly and annual P&L statements, occupancy reports, and tax-ready summaries — all formatted and ready to share with your CA or bank.",includes:["Monthly P&L","Annual summary","Occupancy analysis","Tax-ready format"],price:"\u20b9299/month"},
  {icon:"\ud83d\udd27",title:"Maintenance Coordination",color:T.blue,bg:T.blueL,tagline:"We handle it so you don't have to",desc:"Our team coordinates with vendors, follows up on open tickets, and ensures resolution — all logged in your RentAI dashboard.",includes:["Vendor coordination","Follow-up calls","Photo documentation","Resolution confirmation"],price:"\u20b9199/request"},
  {icon:"\ud83d\udce3",title:"Tenant Listing & Marketing",color:T.plum,bg:T.plumL,tagline:"Fill vacancies faster",desc:"We advertise your vacant units across top platforms, screen inquiries, and shortlist quality tenants — so you only talk to serious prospects.",includes:["Multi-platform listings","Inquiry filtering","Tenant screening","Shortlisting report"],price:"\u20b91,499/listing"},
  {icon:"\u2696\ufe0f",title:"Legal Assistance",color:T.rose,bg:T.roseL,tagline:"Protect your rights",desc:"From eviction notices to compliance checks — our legal partners assist with drafting notices, advising on your rights, and navigating disputes.",includes:["Notice drafting","Eviction guidance","Compliance check","Legal consultation"],price:"\u20b9999/case"},
  {icon:"\ud83e\uddfe",title:"GST & Tax Filing",color:T.green,bg:T.greenL,tagline:"Stay compliant without the stress",desc:"Annual rental income declaration, GST registration for commercial properties, and ITR filing support — handled by qualified CAs.",includes:["Rental income filing","GST registration","ITR support","CA-verified"],price:"\u20b9799/year"},
  {icon:"\ud83c\udfd7\ufe0f",title:"Renovation & Repairs",color:T.amber,bg:T.amberL,tagline:"Quality work, trusted vendors",desc:"Need painting, plumbing, electrical, or civil work? We coordinate with vetted vendors, get quotes, and oversee the work so you don't have to.",includes:["Vendor shortlisting","Quote comparison","Work supervision","Quality sign-off"],price:"Custom quote"},
  {icon:"\ud83d\udcd0",title:"Property Valuation",color:T.teal,bg:T.tealL,tagline:"Know what your property is worth",desc:"Get a certified valuation report for refinancing, selling, or insurance purposes — issued by RERA-registered valuers.",includes:["Site inspection","Market comparison","Certified report","RERA-registered valuer"],price:"\u20b91,999/property"},
];
const WHY=[
  {icon:"\u2705",title:"Vetted Professionals",desc:"All service partners are background-verified and reviewed by landlords on the platform."},
  {icon:"\u26a1",title:"Fast Turnaround",desc:"Most services delivered within 24-48 hours. Urgent requests handled same day."},
  {icon:"\ud83d\udcac",title:"Transparent Pricing",desc:"Fixed prices upfront — no hidden fees, no surprises on your invoice."},
  {icon:"\ud83d\udd17",title:"Linked to Your Dashboard",desc:"All service activity is tracked inside your RentAI account for full visibility."},
];
function CallbackModal({onClose}){
  const [form,setForm]=useState({name:"",phone:"",service:"",time:""});
  const [submitted,setSubmitted]=useState(false);
  const [loading,setLoading]=useState(false);
  const handleSubmit=async()=>{
    if(!form.name||!form.phone)return;
    setLoading(true);
    await new Promise(r=>setTimeout(r,900));
    setLoading(false);setSubmitted(true);
  };
  return(
    <div className="modal-overlay" style={{position:"fixed",inset:0,zIndex:1000,
      background:"rgba(44,36,22,.6)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal-box" style={{background:T.surface,borderRadius:"24px 24px 0 0",
        padding:"32px 24px 40px",width:"100%",maxWidth:480}}>
        {submitted?(
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:52,marginBottom:16}}>\ud83c\udf89</div>
            <h3 style={{fontSize:20,fontWeight:900,color:T.ink,marginBottom:10,fontFamily:"Montserrat,sans-serif"}}>We'll call you back!</h3>
            <p style={{fontSize:14,color:T.ink2,lineHeight:1.7,fontWeight:500,marginBottom:24}}>Our team will reach out within 2 business hours. Check your WhatsApp too!</p>
            <button onClick={onClose} style={{padding:"12px 28px",borderRadius:12,fontSize:14,fontWeight:800,border:"none",
              background:"linear-gradient(135deg,"+T.saffron+","+T.saffronB+")",color:"#ffffff",cursor:"pointer"}}>Done</button>
          </div>
        ):(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
              <h3 style={{fontSize:18,fontWeight:900,color:T.ink,fontFamily:"Montserrat,sans-serif"}}>Request a Callback</h3>
              <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:T.muted}}>\u2715</button>
            </div>
            {[{key:"name",label:"Your Name",placeholder:"Ramesh Kumar",type:"text"},{key:"phone",label:"Phone Number",placeholder:"+91 98765 43210",type:"tel"}].map(f=>(
              <div key={f.key} style={{marginBottom:16}}>
                <label style={{display:"block",fontSize:12,fontWeight:800,color:T.ink2,marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} value={form[f.key]}
                  onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                  style={{width:"100%",padding:"11px 14px",borderRadius:10,fontSize:14,fontWeight:600,
                    border:"1.5px solid "+T.border,background:T.bg,color:T.ink,outline:"none",fontFamily:"Nunito,sans-serif"}}/>
              </div>
            ))}
            <div style={{marginBottom:16}}>
              <label style={{display:"block",fontSize:12,fontWeight:800,color:T.ink2,marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>Service Needed</label>
              <select value={form.service} onChange={e=>setForm(p=>({...p,service:e.target.value}))}
                style={{width:"100%",padding:"11px 14px",borderRadius:10,fontSize:13,fontWeight:600,
                  border:"1.5px solid "+T.border,background:T.bg,color:T.ink,outline:"none",fontFamily:"Nunito,sans-serif"}}>
                <option value="">Select a service...</option>
                {SERVICES.map(s=><option key={s.title} value={s.title}>{s.title}</option>)}
                <option value="General Inquiry">General Inquiry</option>
              </select>
            </div>
            <div style={{marginBottom:24}}>
              <label style={{display:"block",fontSize:12,fontWeight:800,color:T.ink2,marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>Preferred Time</label>
              <select value={form.time} onChange={e=>setForm(p=>({...p,time:e.target.value}))}
                style={{width:"100%",padding:"11px 14px",borderRadius:10,fontSize:13,fontWeight:600,
                  border:"1.5px solid "+T.border,background:T.bg,color:T.ink,outline:"none",fontFamily:"Nunito,sans-serif"}}>
                <option value="">Any time</option>
                <option value="Morning (9am-12pm)">Morning (9am-12pm)</option>
                <option value="Afternoon (12pm-4pm)">Afternoon (12pm-4pm)</option>
                <option value="Evening (4pm-7pm)">Evening (4pm-7pm)</option>
              </select>
            </div>
            <button onClick={handleSubmit} disabled={loading||!form.name||!form.phone}
              style={{width:"100%",padding:"14px 0",borderRadius:12,fontSize:15,fontWeight:900,border:"none",
                cursor:(!form.name||!form.phone)?"not-allowed":"pointer",
                background:(!form.name||!form.phone)?T.border:"linear-gradient(135deg,"+T.saffron+","+T.saffronB+")",
                color:(!form.name||!form.phone)?T.muted:"#ffffff"}}>
              {loading?"Submitting...":"Request Callback \u2192"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
export default function ServicesPage({onGetStarted,onHome}){
  const [showModal,setShowModal]=useState(false);
  return(
    <div style={{fontFamily:"'Nunito',sans-serif",background:T.bg,minHeight:"100vh",color:T.ink}}>
      <style>{CSS}</style>
      {showModal&&<CallbackModal onClose={()=>setShowModal(false)}/>}
      <nav style={{position:"sticky",top:0,zIndex:100,background:T.surface+"EE",
        backdropFilter:"blur(12px)",borderBottom:"1px solid "+T.border,padding:"0 24px",height:60}}>
        <div style={{maxWidth:1000,margin:"0 auto",height:"100%",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div onClick={()=>onHome&&onHome()} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
            <div style={{width:36,height:36,borderRadius:10,
              background:"linear-gradient(135deg,"+T.saffron+","+T.saffronB+")",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 4px 12px "+T.saffron+"40"}}>\ud83c\udfe1</div>
            <span style={{fontSize:19,fontWeight:900,color:T.ink,letterSpacing:"-.3px",fontFamily:"Montserrat,sans-serif"}}>RentAI</span>
            <span style={{fontSize:10,fontWeight:800,color:T.saffron,background:T.saffronL,padding:"2px 9px",borderRadius:20,border:"1px solid "+T.saffron+"30"}}>BETA</span>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <button onClick={()=>onHome&&onHome()} className="ghost-btn"
              style={{padding:"8px 16px",borderRadius:10,fontSize:13,fontWeight:700,border:"none",background:"transparent",color:T.ink2,cursor:"pointer"}}>
              \u2190 Back
            </button>
            <button onClick={onGetStarted} style={{padding:"9px 20px",borderRadius:10,fontSize:13,fontWeight:800,
              border:"1.5px solid "+T.border2,background:"transparent",color:T.ink,cursor:"pointer"}}>Login \u2192</button>
          </div>
        </div>
      </nav>
      <section style={{background:"linear-gradient(135deg,"+T.saffronL+" 0%,"+T.tealL+" 100%)",padding:"56px 24px 52px"}}>
        <div style={{maxWidth:1000,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:32}}>
          <div style={{maxWidth:520}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:7,background:T.surface,
              border:"1.5px solid "+T.teal+"30",borderRadius:30,padding:"6px 16px",marginBottom:20,fontSize:12,fontWeight:800,color:T.teal}}>
              \ud83c\udfaf Professional Services
            </div>
            <h1 style={{fontSize:"clamp(26px,5.5vw,46px)",fontWeight:900,color:T.ink,lineHeight:1.15,
              letterSpacing:"-.4px",marginBottom:18,fontFamily:"Montserrat,sans-serif"}}>
              Hands-on help for{" "}
              <span style={{background:"linear-gradient(135deg,"+T.saffron+","+T.saffronB+")",
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>busy landlords</span>
            </h1>
            <p style={{fontSize:"clamp(13px,3vw,16px)",color:T.ink2,lineHeight:1.75,fontWeight:500,marginBottom:28}}>
              From onboarding to legal — our vetted experts handle the hard parts so you can focus on what matters.
            </p>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <button onClick={()=>setShowModal(true)} className="cta-btn"
                style={{padding:"14px 30px",borderRadius:13,fontSize:15,fontWeight:900,border:"none",color:"#ffffff",cursor:"pointer",
                  background:"linear-gradient(135deg,"+T.saffron+","+T.saffronB+","+T.amber+")",boxShadow:"0 6px 20px "+T.saffron+"40"}}>
                Request a Callback \u2192
              </button>
              <button onClick={onGetStarted} className="ghost-btn"
                style={{padding:"14px 26px",borderRadius:13,fontSize:14,fontWeight:800,
                  border:"2px solid "+T.border2,background:T.surface,color:T.ink2,cursor:"pointer"}}>
                Get Started Free
              </button>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {[
              {emoji:"\ud83d\udd50",text:"Most services delivered in 24-48 hrs"},
              {emoji:"\u2705",text:"All professionals background-verified"},
              {emoji:"\ud83d\udcac",text:"Fixed, transparent pricing upfront"},
            ].map(b=>(
              <div key={b.text} style={{background:T.surface,border:"1px solid "+T.border,borderRadius:14,
                padding:"13px 18px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 2px 8px rgba(44,36,22,.06)"}}>
                <span style={{fontSize:22}}>{b.emoji}</span>
                <span style={{fontSize:13,fontWeight:700,color:T.ink2}}>{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div style={{background:T.ink,padding:"18px 24px"}}>
        <div className="trust-bar" style={{maxWidth:1000,margin:"0 auto",display:"flex",justifyContent:"center",gap:36,flexWrap:"wrap"}}>
          {["9 Services Available","200+ Landlords Served","Verified Professionals","\u20b90 Hidden Fees"].map(t=>(
            <span key={t} style={{fontSize:12,fontWeight:700,color:"#C8B89A"}}>\u2713 {t}</span>
          ))}
        </div>
      </div>
      <section style={{maxWidth:1000,margin:"0 auto",padding:"72px 24px"}}>
        <div style={{textAlign:"center",marginBottom:48}}>
          <h2 style={{fontSize:"clamp(22px,5vw,34px)",fontWeight:900,color:T.ink,letterSpacing:"-.3px",marginBottom:12,fontFamily:"Montserrat,sans-serif"}}>Our Services</h2>
          <p style={{fontSize:14,color:T.ink2,fontWeight:500,maxWidth:440,margin:"0 auto"}}>Everything a landlord needs — handled by experts.</p>
        </div>
        <div className="svc-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
          {SERVICES.map(s=>(
            <div key={s.title} className="svc-card" style={{background:T.surface,border:"1px solid "+T.border,
              borderRadius:20,padding:"24px 20px",boxShadow:"0 2px 8px rgba(44,36,22,.05)"}}>
              <div style={{width:48,height:48,borderRadius:13,background:s.bg,display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:24,marginBottom:14,border:"1px solid "+s.color+"20"}}>{s.icon}</div>
              <div style={{fontSize:10,fontWeight:800,color:s.color,textTransform:"uppercase",letterSpacing:".5px",marginBottom:6}}>{s.tagline}</div>
              <h3 style={{fontSize:14,fontWeight:900,color:T.ink,marginBottom:8,lineHeight:1.35,fontFamily:"Montserrat,sans-serif"}}>{s.title}</h3>
              <p style={{fontSize:12,color:T.ink2,lineHeight:1.7,fontWeight:500,marginBottom:14}}>{s.desc}</p>
              <div style={{marginBottom:16}}>
                {s.includes.map(i=>(
                  <div key={i} style={{fontSize:11,color:T.ink2,fontWeight:600,padding:"2px 0",display:"flex",alignItems:"center",gap:6}}>
                    <span style={{color:T.teal,fontSize:10}}>\u2713</span> {i}
                  </div>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:14,borderTop:"1px solid "+T.border}}>
                <span style={{fontSize:13,fontWeight:900,color:s.color,fontFamily:"Montserrat,sans-serif"}}>{s.price}</span>
                <button onClick={()=>setShowModal(true)}
                  style={{padding:"7px 16px",borderRadius:9,fontSize:11,fontWeight:800,
                    border:"1.5px solid "+s.color,background:"transparent",color:s.color,cursor:"pointer"}}>
                  Book \u2192
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section style={{background:T.panel,padding:"72px 24px"}}>
        <div style={{maxWidth:1000,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:44}}>
            <h2 style={{fontSize:"clamp(22px,5vw,34px)",fontWeight:900,color:T.ink,letterSpacing:"-.3px",fontFamily:"Montserrat,sans-serif"}}>Why choose RentAI Services?</h2>
          </div>
          <div className="why-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:24}}>
            {WHY.map(w=>(
              <div key={w.title} style={{textAlign:"center"}}>
                <div style={{fontSize:36,marginBottom:14}}>{w.icon}</div>
                <h3 style={{fontSize:14,fontWeight:800,color:T.ink,marginBottom:8,fontFamily:"Montserrat,sans-serif"}}>{w.title}</h3>
                <p style={{fontSize:12,color:T.ink2,lineHeight:1.7,fontWeight:500}}>{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section style={{padding:"72px 24px"}}>
        <div style={{maxWidth:1000,margin:"0 auto",background:"linear-gradient(135deg,"+T.ink+",#3C3020)",
          borderRadius:24,padding:"52px 28px",textAlign:"center"}}>
          <div style={{fontSize:44,marginBottom:16}}>\ud83d\udcde</div>
          <h2 style={{fontSize:"clamp(20px,5vw,32px)",fontWeight:900,color:"#fff",letterSpacing:"-.3px",marginBottom:12,fontFamily:"Montserrat,sans-serif"}}>Ready to get started?</h2>
          <p style={{fontSize:14,color:"#C8B89A",fontWeight:500,maxWidth:380,margin:"0 auto 28px",lineHeight:1.75}}>Book a callback and our team will reach out within 2 business hours.</p>
          <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={()=>setShowModal(true)} className="cta-btn"
              style={{padding:"14px 32px",borderRadius:13,fontSize:15,fontWeight:900,border:"none",color:"#ffffff",cursor:"pointer",
                background:"linear-gradient(135deg,"+T.saffron+","+T.saffronB+","+T.amber+")",boxShadow:"0 6px 20px "+T.saffron+"40"}}>
              Request a Callback \u2192
            </button>
            <button onClick={()=>window.open("mailto:support@rentai.co.in","_blank")}
              style={{padding:"14px 28px",borderRadius:13,fontSize:14,fontWeight:800,
                border:"2px solid #6B5A4A",background:"transparent",color:"#C8B89A",cursor:"pointer"}}>
              Email Us
            </button>
          </div>
        </div>
      </section>
      <footer style={{background:T.ink,padding:"36px 24px 24px",borderTop:"1px solid #3C3426"}}>
        <div style={{maxWidth:1000,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,"+T.saffron+","+T.saffronB+")",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>\ud83c\udfe1</div>
            <span style={{fontSize:15,fontWeight:900,color:"#fff",fontFamily:"Montserrat,sans-serif"}}>RentAI</span>
          </div>
          <div style={{fontSize:11,color:"#6B5A4A",fontWeight:600}}>\u00a9 2025 RentAI. Made with \u2764\ufe0f in India.</div>
          <div style={{fontSize:11,color:"#6B5A4A",fontWeight:600}}>support@rentai.co.in</div>
        </div>
      </footer>
    </div>
  );
}