import React, { useState, useEffect } from 'react';
import { CreditCard, ArrowUpRight, ArrowDownLeft, DollarSign, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../context/AuthContext';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

interface Transaction {
  _id: string;
  type: string;
  amount: number;
  status: string;
  relatedUser: { name: string } | null;
  createdAt: string;
}

export const PaymentsPage: React.FC = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const fetchWallet = async () => {
    try {
      const res = await api.get('/payments/transactions');
      setTransactions(res.data.transactions);
      setBalance(res.data.walletBalance ?? 0);
    } catch (error) {
      toast.error('Failed to load wallet data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleDeposit = async () => {
    if (!depositAmount || isNaN(Number(depositAmount)) || Number(depositAmount) <= 0) return;
    try {
      // In a real app we'd redirect to Stripe Checkout or open a Stripe Canvas here
      // For the mock simulation as requested, we'll assume the intent simulates success
      await api.post('/payments/deposit', { amount: Number(depositAmount) });
      toast.success('Deposit initiated. Refreshing balance...');
      setDepositAmount('');
      fetchWallet();
    } catch (error) {
      toast.error('Deposit failed');
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || isNaN(Number(withdrawAmount)) || Number(withdrawAmount) <= 0) return;
    try {
      await api.post('/payments/withdraw', { amount: Number(withdrawAmount) });
      toast.success('Withdrawal processed successfully');
      setWithdrawAmount('');
      fetchWallet();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Withdrawal failed');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments & Wallet</h1>
          <p className="text-gray-600">Manage your funds and transaction history</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wallet Balance Card */}
        <Card className="lg:col-span-1 bg-primary-600 text-white border-0 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10"></div>
          <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-white opacity-10"></div>
          
          <CardBody className="relative z-10 pt-8 pb-8 flex flex-col justify-between h-full space-y-6">
            <div>
              <p className="text-primary-500 mb-1 text-sm font-medium">Available Balance</p>
              <h2 className="text-black text-5xl font-bold">${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm inline-block">
                User ID: {user?.id.substring(0, 8).toUpperCase()}
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Quick Actions */}
        <Card className="lg:col-span-2 border-gray-200">
          <CardHeader>
            <h2 className="text-lg font-medium text-gray-900">Quick Actions</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Deposit */}
            <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 text-gray-900 font-medium">
                <div className="bg-green-100 p-2 rounded-full text-green-600">
                  <ArrowDownLeft size={18} />
                </div>
                Add Funds
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><DollarSign size={16} /></span>
                  <input 
                    type="number" 
                    placeholder="Amount" 
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition-all shadow-sm"
                  />
                </div>
                <Button onClick={handleDeposit}>Deposit</Button>
              </div>
            </div>

            {/* Withdraw */}
            <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 text-gray-900 font-medium">
                <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                  <ArrowUpRight size={18} />
                </div>
                Withdraw Funds
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><DollarSign size={16} /></span>
                  <input 
                    type="number" 
                    placeholder="Amount" 
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition-all shadow-sm"
                  />
                </div>
                <Button variant="outline" onClick={handleWithdraw}>Withdraw</Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Transaction History */}
      <Card className="border-gray-200">
        <CardHeader>
          <h2 className="text-lg font-medium text-gray-900">Recent Transactions</h2>
        </CardHeader>
        <CardBody>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-primary-600" size={32} />
            </div>
          ) : transactions.length === 0 ? (
           <div className="text-center p-8 text-gray-500">
             <CreditCard className="mx-auto h-12 w-12 text-gray-300 mb-3" />
             <p>No transactions found.</p>
           </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {transactions.map(txn => (
                <div key={txn._id} className="flex justify-between items-center py-4 hover:bg-gray-50 px-2 rounded-md transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${
                      txn.type === 'deposit' ? 'bg-green-100 text-green-600' : 
                      txn.type === 'withdraw' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-600'
                     }`}>
                      {txn.type === 'deposit' ? <ArrowDownLeft size={20} /> : 
                       txn.type === 'withdraw' ? <ArrowUpRight size={20} /> : <CreditCard size={20} />}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 capitalize">{txn.type}</p>
                      <p className="text-sm text-gray-500">{new Date(txn.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${txn.type === 'withdraw' || txn.type === 'transfer' ? 'text-gray-900' : 'text-green-600'}`}>
                      {txn.type === 'withdraw' || txn.type === 'transfer' ? '-' : '+'}${txn.amount.toFixed(2)}
                    </p>
                    <Badge variant={txn.status === 'completed' ? 'primary' : 'secondary'} size="sm" className="mt-1">
                      {txn.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
