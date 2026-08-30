import React from "react";
import "./QRCodeGenerator.css";

export default function QRCodeGenerator({
  value="https://example.com",
  title="Scan QR Code",
  size=160,
  downloadName="qrcode"
}){
  const downloadQR=()=>{
    const svg=document.querySelector(".qr-generator svg");
    if(!svg) return;
    const data=new XMLSerializer().serializeToString(svg);
    const blob=new Blob([data],{type:"image/svg+xml"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`${downloadName}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return(
    <div className="qr-generator">
      <h3>{title}</h3>
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ background: '#fff', padding: '8px', borderRadius: '8px' }}>
        <rect width="100" height="100" fill="white"/>
        {/* Mock QR matrix elements */}
        <rect x="10" y="10" width="25" height="25" fill="#0f172a" />
        <rect x="15" y="15" width="15" height="15" fill="white" />
        <rect x="18" y="18" width="9" height="9" fill="#0f172a" />

        <rect x="65" y="10" width="25" height="25" fill="#0f172a" />
        <rect x="70" y="15" width="15" height="15" fill="white" />
        <rect x="73" y="18" width="9" height="9" fill="#0f172a" />

        <rect x="10" y="65" width="25" height="25" fill="#0f172a" />
        <rect x="15" y="70" width="15" height="15" fill="white" />
        <rect x="18" y="73" width="9" height="9" fill="#0f172a" />

        <rect x="45" y="15" width="10" height="10" fill="#0f172a" />
        <rect x="45" y="45" width="15" height="15" fill="#0f172a" />
        <rect x="65" y="45" width="10" height="20" fill="#0f172a" />
        <rect x="45" y="68" width="20" height="10" fill="#0f172a" />
        <rect x="70" y="70" width="15" height="15" fill="#0f172a" />
      </svg>
      <p style={{ wordBreak: 'break-all', fontSize: '12px', marginTop: '8px', color: '#64748b' }}>{value}</p>
      <button onClick={downloadQR} style={{ marginTop: '8px', cursor: 'pointer' }}>Download QR</button>
    </div>
  );
}
