import { PublicKey } from "@solana/web3.js";
import express from "express";

const HELIUS_API_KEY = "07ed88b0-3573-4c79-8d62-3a2cbd5c141a";
const TOKEN_MINT = "47TE3qRYoWdGFcvafubPLHPtNmhRQtcTWDUWkLw4oNy8";

const app = express();

// Cabal Ranks
const CABAL_RANKS = [
    { name: "Academy", min: 10000, max: 50000, reward: 0.01, color: "#4a5568" },
    { name: "Clan", min: 50000, max: 100000, reward: 0.1, color: "#2d3748" },
    { name: "1st Royal Guard", min: 100000, max: 200000, reward: 0.2, color: "#2b6cb0" },
    { name: "2nd Royal Guard", min: 200000, max: 300000, reward: 0.3, color: "#2c5aa0" },
    { name: "1st Order of Knights", min: 300000, max: 400000, reward: 0.4, color: "#e53e3e" },
    { name: "2nd Order of Knights", min: 400000, max: 500000, reward: 0.5, color: "#c53030" },
    { name: "3rd Order of Knights", min: 500000, max: 600000, reward: 0.6, color: "#9b2c2c" },
    { name: "4th Order of Knights", min: 600000, max: 1000000, reward: 0.7, color: "#742a2a" },
    { name: "CABAL", min: 1000000, max: Infinity, reward: 1.0, color: "#000000" }
];

let burnTracker = new Map();
let totalBurned = 0;

function getCabalRank(burned) {
    return CABAL_RANKS.find(rank => burned >= rank.min && burned < rank.max) || CABAL_RANKS[0];
}

app.get("/", (req, res) => {
    const topBurners = Array.from(burnTracker.entries())
        .map(([wallet, burned]) => ({ 
            wallet, 
            burned,
            rank: getCabalRank(burned)
        }))
        .sort((a, b) => b.burned - a.burned);

    res.setHeader("Content-Type", "text/html");
    res.end(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>THE CABAL - Burn Ranks</title>
            <style>
                body { 
                    background: #0a0a0a; 
                    color: #c0c0c0; 
                    font-family: 'Georgia', serif;
                    padding: 20px;
                }
                .header { 
                    text-align: center; 
                    border-bottom: 2px solid gold; 
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .cabal-title {
                    font-size: 3em;
                    color: gold;
                    text-shadow: 2px 2px 4px #000;
                    letter-spacing: 8px;
                }
                .total-burned {
                    font-size: 1.2em;
                    color: #ff6b6b;
                    margin: 20px 0;
                }
                .burner {
                    margin: 15px 0;
                    padding: 15px;
                    border-radius: 5px;
                    border-left: 5px solid;
                    background: rgba(255,255,255,0.05);
                }
                .rank-badge {
                    background: #333;
                    padding: 4px 12px;
                    border-radius: 15px;
                    font-size: 0.8em;
                    margin-right: 10px;
                    border: 1px solid;
                }
                .wallet {
                    color: #87ceeb;
                    font-weight: bold;
                }
                .amount {
                    color: #ff6b6b;
                    font-weight: bold;
                    float: right;
                }
                .reward {
                    color: gold;
                    font-size: 0.9em;
                    margin-left: 10px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="cabal-title">THE CABAL</div>
                <div class="total-burned">Total Burned: ${totalBurned.toLocaleString()} tokens</div>
                <div>Tracked Burners: ${burnTracker.size}</div>
            </div>

            <h3 style="color: gold;">ORGANIZATIONAL RANKS</h3>
            ${topBurners.map((burner, index) => `
                <div class="burner" style="border-color: ${burner.rank.color}">
                    <span class="rank-badge" style="border-color: ${burner.rank.color}; color: ${burner.rank.color}">
                        ${burner.rank.name}
                    </span>
                    <span class="wallet">${burner.wallet}</span>
                    <span class="amount">${burner.burned.toLocaleString()} burned</span>
                    <span class="reward">${burner.rank.reward}% fees</span>
                </div>
            `).join('')}
        </body>
        </html>
    `);
});

// Get all token accounts for this mint in batch
async function getAllTokenAccounts() {
    try {
        console.log("🔍 Getting all token accounts...");
        
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "getTokenAccounts",
                params: {
                    mint: TOKEN_MINT,
                    page: 1,
                    limit: 1000
                }
            })
        });

        const data = await response.json();
        return data.result?.token_accounts || [];
    } catch (e) {
        console.log('Error getting token accounts:', e.message);
        return [];
    }
}

// Get transaction history for a wallet to find burns
async function getWalletBurnHistory(wallet) {
    try {
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "getSignaturesForAddress",
                params: [
                    wallet,
                    {
                        limit: 100,
                        commitment: "confirmed"
                    }
                ]
            })
        });

        const data = await response.json();
        const signatures = data.result || [];
        
        let totalBurned = 0;
        
        // Check each transaction for burns
        for (const sig of signatures) {
            const burnAmount = await checkTransactionForBurn(sig.signature, wallet);
            totalBurned += burnAmount;
        }
        
        return totalBurned;
    } catch (e) {
        console.log(`Error checking wallet ${wallet}:`, e.message);
        return 0;
    }
}

// Check if a transaction contains burns from this wallet
async function checkTransactionForBurn(signature, wallet) {
    try {
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "getTransaction",
                params: [
                    signature,
                    {
                        encoding: "jsonParsed",
                        commitment: "confirmed"
                    }
                ]
            })
        });

        const data = await response.json();
        const tx = data.result;
        
        if (!tx?.meta) return 0;
        
        // Check pre/post token balances for this wallet
        const preBalances = tx.meta.preTokenBalances || [];
        const postBalances = tx.meta.postTokenBalances || [];
        
        const preBalance = preBalances.find(b => 
            b.mint === TOKEN_MINT && b.owner === wallet
        );
        const postBalance = postBalances.find(b => 
            b.mint === TOKEN_MINT && b.owner === wallet
        );
        
        const preAmount = preBalance?.uiTokenAmount?.uiAmount || 0;
        const postAmount = postBalance?.uiTokenAmount?.uiAmount || 0;
        
        // If tokens decreased and no other wallet received them, it's a burn
        if (preAmount > postAmount) {
            const burned = preAmount - postAmount;
            
            // Quick check: if no other wallet received significant amounts, count as burn
            const otherReceivers = postBalances.filter(b => 
                b.mint === TOKEN_MINT && b.owner !== wallet
            );
            
            if (otherReceivers.length === 0) {
                return burned;
            }
        }
        
        return 0;
    } catch (e) {
        return 0;
    }
}

// Batch scan all holders for burns
async function batchScanBurns() {
    try {
        console.log("🚀 Starting batch burn scan...");
        
        const tokenAccounts = await getAllTokenAccounts();
        console.log(`📊 Found ${tokenAccounts.length} token accounts`);
        
        let processed = 0;
        
        for (const account of tokenAccounts) {
            const wallet = account.owner;
            
            if (burnTracker.has(wallet)) {
                processed++;
                continue;
            }
            
            const burned = await getWalletBurnHistory(wallet);
            
            if (burned > 0) {
                burnTracker.set(wallet, burned);
                totalBurned += burned;
                console.log(`🔥 ${wallet} burned ${burned} tokens`);
            }
            
            processed++;
            
            // Progress update
            if (processed % 10 === 0) {
                console.log(`⏳ Processed ${processed}/${tokenAccounts.length} accounts`);
            }
            
            // Rate limiting
            await new Promise(r => setTimeout(r, 100));
        }
        
        console.log(`✅ Batch scan complete! Found ${burnTracker.size} burners`);
        
    } catch (e) {
        console.log('Batch scan error:', e.message);
    }
}

app.listen(1000, () => {
    console.log('🔥 CABAL batch scanner at http://localhost:1000');
    batchScanBurns();
    
    // Rescan every hour
    setInterval(batchScanBurns, 60 * 60 * 1000);
});
