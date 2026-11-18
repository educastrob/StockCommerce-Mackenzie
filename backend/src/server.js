const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./database');
const auth = require('./authMiddleware');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ================= AUTENTICAÇÃO (RF01 / UC02) =================
app.post('/api/register', async (req, res) => {
    const { nome, email, senha } = req.body;
    try {
        const hash = await bcrypt.hash(senha, 10);
        const result = await pool.query(
            'INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3) RETURNING id, nome, email',
            [nome, email, hash]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(400).json({ erro: 'E-mail já cadastrado ou dados inválidos.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ erro: 'Usuário não encontrado.' });

        const usuario = result.rows[0];
        // Aceita senha criptografada ou '123456' para facilitar testes rápidos na apresentação
        const senhaValida = (senha === '123456' && email === 'admin@stock.com') || await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) return res.status(401).json({ erro: 'Senha incorreta.' });

        const token = jwt.sign({ id: usuario.id, nome: usuario.nome }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
    } catch (err) {
        res.status(500).json({ erro: 'Erro interno no login.' });
    }
});

// ================= PRODUTOS E ESTOQUE (RF02, RF04, RF05 / UC03) =================
app.get('/api/produtos', auth, async (req, res) => {
    const result = await pool.query('SELECT * FROM produtos ORDER BY id ASC');
    res.json(result.rows);
});

app.post('/api/produtos', auth, async (req, res) => {
    const { nome, sku, preco_custo, preco_venda, qtd_estoque, estoque_minimo } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO produtos (nome, sku, preco_custo, preco_venda, qtd_estoque, estoque_minimo) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [nome, sku, preco_custo || 0, preco_venda, qtd_estoque || 0, estoque_minimo || 5]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(400).json({ erro: 'Erro ao cadastrar produto. Verifique se o SKU já existe.' });
    }
});

// Entrada manual de estoque (RF05)
app.patch('/api/produtos/:id/entrada', auth, async (req, res) => {
    const { id } = req.params;
    const { quantidade } = req.body;
    const result = await pool.query(
        'UPDATE produtos SET qtd_estoque = qtd_estoque + $1 WHERE id = $2 RETURNING *',
        [Number(quantidade), id]
    );
    res.json(result.rows[0]);
});

// ================= PEDIDOS E TRANSAÇÃO ACID (RF06, RF07 / UC06) =================
app.get('/api/pedidos', auth, async (req, res) => {
    const result = await pool.query('SELECT * FROM pedidos ORDER BY id DESC');
    res.json(result.rows);
});

app.post('/api/pedidos', auth, async (req, res) => {
    const { itens, forma_pagamento } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        let valorTotal = 0;
        const itensProcessados = [];

        for (const item of itens) {
            const prodRes = await client.query('SELECT * FROM produtos WHERE id = $1 FOR UPDATE', [item.produto_id]);
            const produto = prodRes.rows[0];

            if (!produto) throw new Error('Produto não encontrado.');
            if (produto.qtd_estoque < item.quantidade) {
                throw new Error(`Estoque insuficiente para ${produto.nome}. Disponível: ${produto.qtd_estoque}`);
            }

            const subtotal = Number(produto.preco_venda) * Number(item.quantidade);
            valorTotal += subtotal;
            itensProcessados.push({ ...item, preco_unitario: produto.preco_venda, subtotal });

            await client.query('UPDATE produtos SET qtd_estoque = qtd_estoque - $1 WHERE id = $2', [item.quantidade, produto.id]);
        }

        const pedidoRes = await client.query(
            'INSERT INTO pedidos (usuario_id, valor_total, status, forma_pagamento) VALUES ($1, $2, $3, $4) RETURNING *',
            [req.usuario.id, valorTotal, 'Pago', forma_pagamento || 'Cartão/Pix']
        );
        const pedido = pedidoRes.rows[0];

        for (const ip of itensProcessados) {
            await client.query(
                'INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario, subtotal) VALUES ($1, $2, $3, $4, $5)',
                [pedido.id, ip.produto_id, ip.quantidade, ip.preco_unitario, ip.subtotal]
            );
        }

        await client.query('COMMIT');
        res.status(201).json(pedido);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ erro: err.message });
    } finally {
        client.release();
    }
});

// Cancelar pedido e recompor estoque (RF07)
app.patch('/api/pedidos/:id/cancelar', auth, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const pedRes = await client.query('SELECT * FROM pedidos WHERE id = $1', [id]);
        if (pedRes.rows[0]?.status === 'Cancelado') throw new Error('Pedido já cancelado.');

        const itensRes = await client.query('SELECT * FROM itens_pedido WHERE pedido_id = $1', [id]);
        for (const item of itensRes.rows) {
            await client.query('UPDATE produtos SET qtd_estoque = qtd_estoque + $1 WHERE id = $2', [item.quantidade, item.produto_id]);
        }

        await client.query("UPDATE pedidos SET status = 'Cancelado' WHERE id = $1", [id]);
        await client.query('COMMIT');
        res.json({ mensagem: 'Pedido cancelado e estoque recomposto.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ erro: err.message });
    } finally {
        client.release();
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`StockCommerce API rodando na porta ${PORT}`));