import React,{useState} from "react";
import "./AIBookSummaryCard.css";

export default function AIBookSummaryCard({
  title="Atomic Habits",
  author="James Clear",
  summary="Small improvements every day compound into remarkable results over time.",
  readingTime="2 min",
  confidence=96,
  keyPoints=["Small habits matter","Identity drives behavior","Consistency wins"],
  onCopy=()=>{},
  onShare=()=>{},
  onRegenerate=()=>{}
}){
  const [expanded,setExpanded]=useState(false);
  const text=expanded?summary:summary.slice(0,140)+(summary.length>140?"...":"");
  const copy=async()=>{
    await navigator.clipboard.writeText(summary);
    onCopy(summary);
  };
  return(
    <div className="ai-summary-card">
      <div className="ai-summary-card__header">
        <div>
          <h3 className="ai-summary-title">AI Summary: {title}</h3>
          <p>{author}</p>
        </div>
        <span className="badge">{confidence}% AI Confidence</span>
      </div>

      <div className="meta">
        <span>🤖 AI Summary</span>
        <span>⏱ {readingTime}</span>
      </div>

      <p className="summary">{text}</p>

      <button className="toggle" onClick={()=>setExpanded(!expanded)}>
        {expanded?"Show Less":"Read More"}
      </button>

      <ul className="points">
        {keyPoints.map((p,i)=><li key={i}>{p}</li>)}
      </ul>

      <div className="actions">
        <button onClick={copy}>Copy</button>
        <button onClick={onShare}>Share</button>
        <button onClick={onRegenerate}>Regenerate</button>
      </div>
    </div>
  );
}
