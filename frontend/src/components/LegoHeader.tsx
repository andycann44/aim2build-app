export default function LegoHeader(){
  return (
    <div style={{background:"#ffd400",padding:"12px 16px",borderBottom:"6px solid #e0b800",display:"flex",gap:12,alignItems:"center"}}>
      <div style={{width:36,height:24,background:"#ff2d2d",border:"3px solid #b81b1b",borderRadius:4,position:"relative"}}>
        {[0,1,2].map(i=>(
          <div key={i} style={{position:"absolute",top:-8,left:5+i*9,width:8,height:8,background:"#ff5959",border:"2px solid #b81b1b",borderRadius:"50%"}}/>
        ))}
      </div>
      <strong>Aim2Build</strong>
    </div>
  );
}
