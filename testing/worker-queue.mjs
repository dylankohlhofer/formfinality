// Prototype only. One transferred frame in flight, one replaceable latest frame.
// Capture timestamps are monotonic on the same clock as now(); they are not arrival times.
export class PoseWorkerQueue {
  constructor(worker, {now=()=>performance.now(), maxAgeMs=200, onResult=()=>{}, onError=e=>{throw e;}}={}) {
    this.worker=worker;this.now=now;this.maxAgeMs=maxAgeMs;this.onResult=onResult;this.onError=onError;
    this.generation=0;this.sequence=0;this.lastTimestamp=-Infinity;this.inFlight=null;this.pending=null;this.closed=false;
    this.stats={submitted:0,processed:0,accepted:0,replaced:0,stale:0,oldGeneration:0};
    worker.onmessage=e=>this.receive(e.data);
    worker.onerror=e=>{this.close();this.onError(new Error(e.message||'Worker failed'));};
  }
  submit(bitmap,capturedAt){
    if(this.closed){bitmap.close();return false;}
    if(!Number.isFinite(capturedAt)||capturedAt<=this.lastTimestamp){bitmap.close();throw new Error('Nonmonotonic frame timestamp');}
    if(capturedAt>this.now()){bitmap.close();throw new Error('Future frame timestamp');}
    this.lastTimestamp=capturedAt;this.stats.submitted++;
    const item={bitmap,capturedAt,id:++this.sequence,generation:this.generation};
    if(this.inFlight){if(this.pending){this.pending.bitmap.close();this.stats.replaced++;}this.pending=item;}
    else this.send(item);
    return true;
  }
  send(item){
    if(this.now()-item.capturedAt>this.maxAgeMs){item.bitmap.close();this.stats.stale++;return;}
    this.inFlight=item;
    try{this.worker.postMessage({type:'frame',...item},[item.bitmap]);}
    catch(error){item.bitmap.close();this.close();this.onError(error);}
  }
  receive(message){
    if(this.closed||!this.inFlight||message.id!==this.inFlight.id)return;
    const item=this.inFlight;this.inFlight=null;this.stats.processed++;
    if(message.type==='error'){this.close();this.onError(new Error(message.error));return;}
    if(message.type!=='result'){this.close();this.onError(new Error('Unexpected worker response'));return;}
    let accepted=null;
    if(item.generation!==this.generation)this.stats.oldGeneration++;
    else if(this.now()-item.capturedAt>this.maxAgeMs)this.stats.stale++;
    else accepted={...message,capturedAt:item.capturedAt,ageMs:this.now()-item.capturedAt};
    const next=this.pending;this.pending=null;
    if(next&&!this.closed)this.send(next);
    if(accepted&&!this.closed){this.stats.accepted++;this.onResult(accepted);}
  }
  reset(){
    this.generation++;
    if(this.pending){this.pending.bitmap.close();this.pending=null;}
    // Do not pretend the old inference was cancelled: await its acknowledgement
    // before sending the new generation, keeping the worker queue bounded.
  }
  close(){
    if(this.closed)return;this.closed=true;
    if(this.pending)this.pending.bitmap.close();this.pending=null;this.inFlight=null;
    this.worker.terminate();
  }
}
