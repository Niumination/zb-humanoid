export function createExpressionBlends(basePositions) {
  const count = basePositions.length / 3;
  
  // Create delta positions for each expression
  const happy = new Float32Array(basePositions.length);
  const sad = new Float32Array(basePositions.length);
  const angry = new Float32Array(basePositions.length);
  const excited = new Float32Array(basePositions.length);
  const calm = new Float32Array(basePositions.length);
  
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const x = basePositions[i3];
    const y = basePositions[i3 + 1];
    const z = basePositions[i3 + 2];
    
    // HAPPY: mouth corners up, cheeks up
    const mouthDist = Math.sqrt(x * x + Math.pow(y + 0.15, 2));
    if (mouthDist < 0.3) {
      happy[i3 + 1] += 0.03; // mouth up
      happy[i3] += x * 0.1; // corners wider
    }
    if (y < -0.2 && Math.abs(x) > 0.2) {
      happy[i3 + 2] += 0.02; // cheeks forward
    }
    
    // SAD: mouth corners down, eyebrows down
    if (mouthDist < 0.3) {
      sad[i3 + 1] -= 0.02;
    }
    if (y > 0.2 && Math.abs(x) < 0.3) {
      sad[i3 + 1] -= 0.02; // eyebrows down
    }
    
    // ANGRY: eyebrows down/in, jaw tight
    if (y > 0.2 && Math.abs(x) < 0.35) {
      sad[i3 + 1] -= 0.03;
      angry[i3] -= Math.sign(x) * 0.02; // eyebrows in
    }
    if (y < -0.1 && Math.abs(x) < 0.25) {
      angry[i3 + 2] += 0.02; // jaw forward
    }
    
    // EXCITED: eyebrows up, mouth open
    if (y > 0.2 && Math.abs(x) < 0.3) {
      excited[i3 + 1] += 0.04;
    }
    if (mouthDist < 0.25) {
      excited[i3 + 2] -= 0.03; // mouth open
    }
    
    // CALM: relaxed, slight smile
    if (mouthDist < 0.25) {
      calm[i3 + 1] += 0.01;
      calm[i3] += Math.abs(x) * 0.05;
    }
  }
  
  return {
    neutral: new Float32Array(basePositions),
    happy,
    sad,
    angry,
    excited,
    calm
  };
}

export function applyExpression(positions, expressionTargets, mood, intensity = 1.0) {
  const target = expressionTargets[mood];
  if (!target) return positions;
  
  if (!applyExpression._scratch || applyExpression._scratch.length !== positions.length) {
    applyExpression._scratch = new Float32Array(positions);
  }
  const result = applyExpression._scratch;
  result.set(positions);
  for (let i = 0; i < result.length; i++) {
    result[i] += (target[i] - positions[i]) * intensity;
  }
  return result;
}
