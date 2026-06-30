export function getMockEvaluationData(project: string) {
  const numPoints = 288;
  const today = new Date();
  const timestamps: Date[] = [];
  for (let i = 0; i < numPoints; i++) {
    timestamps.push(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, i * 5, 0));
  }

  const makeSoc = (offset = 0) => {
    const arr: number[] = [];
    let soc = 16 + offset;
    for (let i = 0; i < numPoints; i++) {
      // Charge: 0-08:00 (0-96), Discharge: 08:00-23:59 (96-288)
      if (i < 96) { soc = Math.min(95, soc + 0.82); }
      else { soc = Math.max(5, soc - 0.41); }
      arr.push(parseFloat(soc.toFixed(2)));
    }
    return arr;
  };

  const makeP = (sign = 1, scale = 1.0) => Array.from({ length: numPoints }, (_, i) => {
    const base = sign * (Math.sin(i / 18) * 60 + Math.sin(i / 40) * 30) * scale;
    return parseFloat((base + (Math.random() - 0.5) * 8).toFixed(2));
  });

  const makeQ = (scale = 1.0) => Array.from({ length: numPoints }, (_, i) =>
    parseFloat(((Math.cos(i / 22) * 25 + (Math.random() - 0.5) * 6) * scale).toFixed(2))
  );

  const makeFreq = () => Array.from({ length: numPoints }, () =>
    parseFloat((50.0 + (Math.random() - 0.5) * 0.18).toFixed(4))
  );

  const makeVoltage = (base = 22.7) => Array.from({ length: numPoints }, () =>
    parseFloat((base + (Math.random() - 0.5) * 0.4).toFixed(3))
  );

  const soc1 = makeSoc(0);
  const soc2 = makeSoc(2);
  const soc3 = makeSoc(-1);
  const pTotal1 = makeP(1, 1.0);
  const pTotal2 = makeP(1, 0.62);
  const pTotal3 = project === 'SNTL400' ? Array(numPoints).fill(0) : makeP(1, 0.62);

  return {
    timestamps,
    pTotal: { plant1: pTotal1, plant2: pTotal2, plant3: pTotal3 },
    qTotal: { plant1: makeQ(1.0), plant2: makeQ(0.6), plant3: makeQ(0.6) },
    soc: { plant1: soc1, plant2: soc2, plant3: soc3 },
    freq: { plant1: makeFreq(), plant2: makeFreq(), plant3: makeFreq() },
    vab: { plant1: makeVoltage(22.8), plant2: makeVoltage(22.7), plant3: makeVoltage(22.75) },
    vbc: { plant1: makeVoltage(22.76), plant2: makeVoltage(22.72), plant3: makeVoltage(22.78) },
    vca: { plant1: makeVoltage(22.73), plant2: makeVoltage(22.69), plant3: makeVoltage(22.71) },
    cmdP: { plant1: pTotal1.map(v => v + Math.sin(Math.random()) * 5), plant2: pTotal2.map(v => v + 3), plant3: pTotal3.map(v => v + 2) },
    cmdQ: { plant1: makeQ(1.0), plant2: makeQ(0.6), plant3: makeQ(0.6) },
    qBess: { plant1: makeQ(0.8), plant2: makeQ(0.5), plant3: makeQ(0.5) },
    remoteP: { plant1: pTotal1.map(v => v * 0.97), plant2: pTotal2.map(v => v * 0.98), plant3: pTotal3.map(v => v * 0.96) },
    dispatchP: { plant1: pTotal1.map(v => v * 0.95), plant2: pTotal2.map(v => v * 0.94), plant3: pTotal3.map(v => v * 0.93) },
    dailyCycle: { plant1: 0.812, plant2: 0.768, plant3: 0.450 },
    totalCycle: { plant1: 142.18, plant2: 128.45, plant3: 154.30 },
  };
}
