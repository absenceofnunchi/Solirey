const { toBN } = web3.utils;

advanceTimeAndBlock = async (time) => {
    await advanceTime(time);
    await advanceBlock();

    return Promise.resolve(web3.eth.getBlock('latest'));
}

advanceTime = (time) => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [time],
            id: new Date().getTime()
        }, (err, result) => {
            if (err) { return reject(err); }
            return resolve(result);
        });
    });
}

advanceBlock = () => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_mine",
            id: new Date().getTime()
        }, (err, result) => {
            if (err) { return reject(err); }
            const newBlockHash = web3.eth.getBlock('latest').hash;

            return resolve(newBlockHash)
        });
    });
}

getTotalGasCost = async (result) => {
    // calculate the total gas cost
    const gasUsed = result.receipt.gasUsed;
    const tx = await web3.eth.getTransaction(result.tx);
    const gasPrice = tx.gasPrice;
    const totalGasCost = toBN(gasUsed).mul(toBN(gasPrice))
    return totalGasCost
}

module.exports = {
    advanceTime,
    advanceBlock,
    advanceTimeAndBlock,
    getTotalGasCost
}