import { APP_VERSION } from "../version";

export default function LegoHeader(){
  return (
    <div style={{
      background:"#ffd400",
      padding:"12px 16px",
      borderBottom:"6px solid #e0b800",
      display:"flex", alignItems:"center", justifyContent:"space-between"
    }}>
      <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
        <div style={{
          width:36, height:24, background:"#ff2d2d",
          border:"3px solid #b81b1b", borderRadius:4,
          position:"relative", boxShadow:"inset 0 2px 0 rgba(0,0,0,.15)"
        }}>
          {[0,1,2].map(i=>(
            <div key={i} style={{
              position:"absolute", top:-8, left:5+i*9, width:8, height:8,
              background:"#ff5959", border:"2px solid #b81b1b", borderRadius:"50%"
            }}/>
          ))}
        </div>
        <strong>Aim2Build</strong>
      </div>
      <div style={{
        fontSize:12, padding:"2px 8px", border:"1px solid #d4b300",
        borderRadius:12, background:"#ffe876"
      }}>
        v{(typeof __APP_VERSION__!=="undefined" ? __APP_VERSION__ : APP_VERSION)}
      </div>
    </div>
  );
}
