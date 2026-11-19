import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function App() {
    const [token, setToken] = useState(localStorage.getItem('token') || '');
    const [email, setEmail] = useState('admin@stock.com');
    const [senha, setSenha] = useState('123456');
    const [aba, setAba] = useState('produtos');

    const [produtos, setProdutos] = useState([]);
    const [pedidos, setPedidos] = useState([]);
    const [carrinho, setCarrinho] = useState([]);
    const [novoProd, setNovoProd] = useState({ nome: '', sku: '', preco_venda: '', qtd_estoque: '', estoque_minimo: 5 });

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    const carregarDados = async () => {
        if (!token) return;
        const [resProd, resPed] = await Promise.all([
            fetch(`${API_URL}/produtos`, { headers }),
            fetch(`${API_URL}/pedidos`, { headers })
        ]);
        if (resProd.ok) setProdutos(await resProd.json());
        if (resPed.ok) setPedidos(await resPed.json());
    };

    useEffect(() => { carregarDados(); }, [token]);

    const handleLogin = async (e) => {
        e.preventDefault();
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('token', data.token);
            setToken(data.token);
        } else {
            alert(data.erro);
        }
    };

    const criarProduto = async (e) => {
        e.preventDefault();
        const res = await fetch(`${API_URL}/produtos`, {
            method: 'POST',
            headers,
            body: JSON.stringify(novoProd)
        });
        const data = await res.json();
        if (res.ok) {
            setNovoProd({ nome: '', sku: '', preco_venda: '', qtd_estoque: '', estoque_minimo: 5 });
            carregarDados();
        } else {
            alert(data.erro);
        }
    };

    const darEntradaEstoque = async (id) => {
        const qtd = prompt('Quantidade para dar entrada no estoque:');
        if (!qtd || isNaN(qtd)) return;
        await fetch(`${API_URL}/produtos/${id}/entrada`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ quantidade: Number(qtd) })
        });
        carregarDados();
    };

    const adicionarAoCarrinho = (produto) => {
        const existente = carrinho.find(i => i.produto_id === produto.id);
        if (existente) {
            setCarrinho(carrinho.map(i => i.produto_id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i));
        } else {
            setCarrinho([...carrinho, { produto_id: produto.id, nome: produto.nome, preco: produto.preco_venda, quantidade: 1 }]);
        }
    };

    const finalizarPedido = async () => {
        if (carrinho.length === 0) return alert('Adicione itens ao pedido.');
        const res = await fetch(`${API_URL}/pedidos`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ itens: carrinho, forma_pagamento: 'Cartão/Pix' })
        });
        const data = await res.json();
        if (res.ok) {
            alert('Pedido finalizado com sucesso!');
            setCarrinho([]);
            carregarDados();
        } else {
            alert(data.erro);
        }
    };

    const cancelarPedido = async (id) => {
        const res = await fetch(`${API_URL}/pedidos/${id}/cancelar`, { method: 'PATCH', headers });
        const data = await res.json();
        alert(data.mensagem || data.erro);
        carregarDados();
    };

    // TELA DE LOGIN
    if (!token) {
        return (
            <div style={{ maxWidth: 360, margin: '100px auto', background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <h2>StockCommerce - Login</h2>
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" required style={{ padding: 8 }} />
                    <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Senha" required style={{ padding: 8 }} />
                    <button type="submit" style={{ padding: 10, background: '#1e40af', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Entrar</button>
                </form>
            </div>
        );
    }

    // PAINEL PRINCIPAL
    return (
        <div style={{ maxWidth: 960, margin: '20px auto', padding: 20 }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e3a8a', color: '#fff', padding: '12px 20px', borderRadius: 8 }}>
                <h2 style={{ margin: 0 }}>StockCommerce</h2>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setAba('produtos')} style={{ padding: '6px 12px', cursor: 'pointer' }}>Produtos e Estoque</button>
                    <button onClick={() => setAba('pedidos')} style={{ padding: '6px 12px', cursor: 'pointer' }}>Pedidos de Venda</button>
                    <button onClick={() => { localStorage.removeItem('token'); setToken(''); }} style={{ padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer' }}>Sair</button>
                </div>
            </header>

            {aba === 'produtos' && (
                <div style={{ marginTop: 20, background: '#fff', padding: 20, borderRadius: 8 }}>
                    <h3>Cadastrar Novo Produto (UC03)</h3>
                    <form onSubmit={criarProduto} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                        <input placeholder="Nome" value={novoProd.nome} onChange={e => setNovoProd({ ...novoProd, nome: e.target.value })} required style={{ padding: 6 }} />
                        <input placeholder="SKU (ex: PROD-003)" value={novoProd.sku} onChange={e => setNovoProd({ ...novoProd, sku: e.target.value })} required style={{ padding: 6 }} />
                        <input type="number" step="0.01" placeholder="Preço Venda" value={novoProd.preco_venda} onChange={e => setNovoProd({ ...novoProd, preco_venda: e.target.value })} required style={{ padding: 6, width: 110 }} />
                        <input type="number" placeholder="Qtd Inicial" value={novoProd.qtd_estoque} onChange={e => setNovoProd({ ...novoProd, qtd_estoque: e.target.value })} required style={{ padding: 6, width: 100 }} />
                        <input type="number" placeholder="Estoque Mín." value={novoProd.estoque_minimo} onChange={e => setNovoProd({ ...novoProd, estoque_minimo: e.target.value })} required style={{ padding: 6, width: 100 }} />
                        <button type="submit" style={{ padding: '6px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Salvar</button>
                    </form>

                    <h3>Catálogo e Controle de Estoque</h3>
                    <table width="100%" border="1" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#e5e7eb' }}>
                            <tr>
                                <th>SKU</th>
                                <th>Produto</th>
                                <th>Preço</th>
                                <th>Estoque Atual</th>
                                <th>Status (RF04)</th>
                                <th>Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {produtos.map(p => {
                                const baixo = p.qtd_estoque <= p.estoque_minimo;
                                return (
                                    <tr key={p.id} style={{ background: baixo ? '#fee2e2' : '#fff' }}>
                                        <td>{p.sku}</td>
                                        <td>{p.nome}</td>
                                        <td>R$ {Number(p.preco_venda).toFixed(2)}</td>
                                        <td><strong>{p.qtd_estoque}</strong> (Mín: {p.estoque_minimo})</td>
                                        <td style={{ color: baixo ? '#b91c1c' : '#15803d', fontWeight: 'bold' }}>
                                            {baixo ? 'ALERTA: Estoque Baixo!' : 'Normal'}
                                        </td>
                                        <td>
                                            <button onClick={() => darEntradaEstoque(p.id)}>+ Entrada</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {aba === 'pedidos' && (
                <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div style={{ background: '#fff', padding: 20, borderRadius: 8 }}>
                        <h3>Novo Pedido de Venda (UC06)</h3>
                        {produtos.map(p => (
                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                                <span>{p.nome} (Disp: {p.qtd_estoque}) - R$ {p.preco_venda}</span>
                                <button onClick={() => adicionarAoCarrinho(p)}>+ Adicionar</button>
                            </div>
                        ))}

                        <h4 style={{ marginTop: 20 }}>Itens no Carrinho</h4>
                        {carrinho.map(item => (
                            <div key={item.produto_id}>{item.quantidade}x {item.nome} - R$ {(item.quantidade * item.preco).toFixed(2)}</div>
                        ))}
                        <p><strong>Total: R$ {carrinho.reduce((acc, i) => acc + i.quantidade * i.preco, 0).toFixed(2)}</strong></p>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={finalizarPedido} style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Finalizar Pedido</button>
                            <button onClick={() => setCarrinho([])} style={{ padding: '8px 16px' }}>Cancelar / Limpar</button>
                        </div>
                    </div>

                    <div style={{ background: '#fff', padding: 20, borderRadius: 8 }}>
                        <h3>Histórico de Pedidos (RF07)</h3>
                        {pedidos.map(ped => (
                            <div key={ped.id} style={{ padding: 10, border: '1px solid #ddd', marginBottom: 8, borderRadius: 4 }}>
                                <div><strong>Pedido #{ped.id}</strong> — Total: R$ {Number(ped.valor_total).toFixed(2)}</div>
                                <div>Status: <strong>{ped.status}</strong></div>
                                {ped.status !== 'Cancelado' && (
                                    <button onClick={() => cancelarPedido(ped.id)} style={{ marginTop: 6, background: '#dc2626', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer' }}>
                                        Cancelar Pedido (Estornar Estoque)
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}