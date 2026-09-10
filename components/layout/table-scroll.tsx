"use client";

import { useEffect, useRef } from "react";

export function TableScroll({children}:{children:React.ReactNode}) {
  const topRef=useRef<HTMLDivElement>(null); const spacerRef=useRef<HTMLDivElement>(null); const bottomRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{const top=topRef.current,spacer=spacerRef.current,bottom=bottomRef.current;if(!top||!spacer||!bottom)return;const syncWidth=()=>{const table=bottom.querySelector("table");spacer.style.width=`${table?.scrollWidth||bottom.scrollWidth}px`;};const fromTop=()=>{bottom.scrollLeft=top.scrollLeft};const fromBottom=()=>{top.scrollLeft=bottom.scrollLeft};const observer=new ResizeObserver(syncWidth);observer.observe(bottom);const table=bottom.querySelector("table");if(table)observer.observe(table);syncWidth();top.addEventListener("scroll",fromTop);bottom.addEventListener("scroll",fromBottom);return()=>{observer.disconnect();top.removeEventListener("scroll",fromTop);bottom.removeEventListener("scroll",fromBottom)}} ,[]);
  return <div><div ref={topRef} className="table-scroll-top border-b border-slate-100"><div ref={spacerRef}/></div><div ref={bottomRef} className="overflow-x-auto">{children}</div></div>;
}
