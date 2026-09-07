// Classic worker: MediaPipe's pinned WASM loader uses importScripts internally.
let model=null;
self.onmessage=async({data:m})=>{
  try{
    if(m.type==='init'){
      const {FilesetResolver,PoseLandmarker}=await import('/vision_bundle.mjs');
      model=await PoseLandmarker.createFromOptions(await FilesetResolver.forVisionTasks('/wasm'),{
        baseOptions:{modelAssetPath:'/model.task',delegate:m.delegate},runningMode:'VIDEO',numPoses:1});
      self.postMessage({type:'ready'});return;
    }
    if(m.type==='frame'){
      if(!model)throw new Error('Pose worker not ready');
      const start=performance.now(),r=model.detectForVideo(m.bitmap,m.capturedAt);
      self.postMessage({type:'result',id:m.id,generation:m.generation,processingMs:performance.now()-start,landmarks:r.landmarks});
    }
  }catch(error){self.postMessage({type:'error',id:m.id,error:error.message});}
  finally{m.bitmap?.close();}
};
