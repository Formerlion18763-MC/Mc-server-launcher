// Real implementation of Minecraft's RCON protocol (Source RCON, the same
// one Valve's engine uses — Minecraft adopted it as-is). Protocol is simple
// enough to implement directly rather than pulling in a crate: TCP, little-
// endian length-prefixed packets, three fields (request id, packet type,
// body), body is null-terminated with an extra trailing null byte.
// Reference: https://wiki.vg/RCON (the standard documentation for this).
//
// I implemented this from the documented spec rather than guessing — but
// same disclosure as everywhere else in this project: no compiler in my
// own sandbox to execute-test it against a real server.

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

const PACKET_AUTH: i32 = 3;
const PACKET_COMMAND: i32 = 2;
#[allow(dead_code)] // kept for documentation of the RCON protocol's packet types
const PACKET_RESPONSE: i32 = 0;

async fn send_packet(stream: &mut TcpStream, id: i32, ptype: i32, body: &str) -> Result<(), String> {
    let body_bytes = body.as_bytes();
    let len = 4 + 4 + body_bytes.len() + 2; // id + type + body + 2 null terminators
    let mut packet = Vec::with_capacity(4 + len);
    packet.extend_from_slice(&(len as i32).to_le_bytes());
    packet.extend_from_slice(&id.to_le_bytes());
    packet.extend_from_slice(&ptype.to_le_bytes());
    packet.extend_from_slice(body_bytes);
    packet.push(0);
    packet.push(0);
    stream.write_all(&packet).await.map_err(|e| format!("RCON write failed: {e}"))
}

async fn read_packet(stream: &mut TcpStream) -> Result<(i32, i32, String), String> {
    let mut len_buf = [0u8; 4];
    stream.read_exact(&mut len_buf).await.map_err(|e| format!("RCON read failed: {e}"))?;
    let len = i32::from_le_bytes(len_buf) as usize;

    let mut rest = vec![0u8; len];
    stream.read_exact(&mut rest).await.map_err(|e| format!("RCON read failed: {e}"))?;

    let id = i32::from_le_bytes([rest[0], rest[1], rest[2], rest[3]]);
    let ptype = i32::from_le_bytes([rest[4], rest[5], rest[6], rest[7]]);
    // body is rest[8..len-2] (drop the two trailing null bytes)
    let body = String::from_utf8_lossy(&rest[8..rest.len().saturating_sub(2)]).to_string();
    Ok((id, ptype, body))
}

/// Connects, authenticates, sends one command, and returns the server's
/// text response — e.g. rcon_command("localhost", 25575, "pass", "list")
/// returns something like "There are 2 of a max of 20 players online: ...".
pub async fn rcon_command(host: &str, port: u16, password: &str, command: &str) -> Result<String, String> {
    let mut stream = TcpStream::connect((host, port)).await
        .map_err(|e| format!("Couldn't reach RCON on {host}:{port} — is the server running with RCON enabled? ({e})"))?;

    send_packet(&mut stream, 1, PACKET_AUTH, password).await?;
    let (auth_id, _, _) = read_packet(&mut stream).await?;
    if auth_id == -1 {
        return Err("RCON authentication failed — wrong password.".to_string());
    }

    send_packet(&mut stream, 2, PACKET_COMMAND, command).await?;
    let (_, _, response) = read_packet(&mut stream).await?;
    Ok(response)
}

#[derive(serde::Serialize)]
pub struct InventoryItem {
    pub slot: i32,
    pub id: String,
    pub count: i32,
}

/// Reads a player's real current inventory via `/data get entity ... Inventory`
/// and parses Minecraft's SNBT (stringified NBT) response. This is a
/// focused parser for exactly this shape — not a general SNBT parser —
/// since that's all we need here. The command's real output looks like:
/// `Bob has the following entity data: [{Slot: 0b, id: "minecraft:stone", Count: 5b}, ...]`
/// I followed the documented /data command output format for this, but
/// couldn't test it against a real running server (no compiler/Minecraft
/// instance in my own sandbox) — flag any parsing mismatch you hit and
/// I'll adjust it against the real text.
pub fn parse_inventory_response(response: &str) -> Vec<InventoryItem> {
    let mut items = Vec::new();
    // Find each `{...}` compound tag in the list — items are always
    // single-level compounds here (no nested braces in a plain item stack),
    // so splitting on top-level `{`/`}` pairs is safe for this shape.
    let mut depth = 0i32;
    let mut current = String::new();
    for ch in response.chars() {
        match ch {
            '{' => { depth += 1; if depth == 1 { current.clear(); } else { current.push(ch); } }
            '}' => {
                depth -= 1;
                if depth == 0 {
                    if let Some(item) = parse_one_item(&current) { items.push(item); }
                } else {
                    current.push(ch);
                }
            }
            _ => { if depth >= 1 { current.push(ch); } }
        }
    }
    items
}

fn parse_one_item(compound: &str) -> Option<InventoryItem> {
    let slot = extract_field(compound, "Slot")?.trim_end_matches('b').parse().ok()?;
    let id = extract_quoted_field(compound, "id")?;
    let count_str = extract_field(compound, "Count").unwrap_or_else(|| "1b".to_string());
    let count = count_str.trim_end_matches('b').parse().unwrap_or(1);
    Some(InventoryItem { slot, id, count })
}

fn extract_field(compound: &str, key: &str) -> Option<String> {
    let idx = compound.find(&format!("{key}:"))?;
    let rest = &compound[idx + key.len() + 1..];
    let end = rest.find(',').unwrap_or(rest.len());
    Some(rest[..end].trim().to_string())
}

fn extract_quoted_field(compound: &str, key: &str) -> Option<String> {
    let idx = compound.find(&format!("{key}:"))?;
    let rest = &compound[idx + key.len() + 1..];
    let start = rest.find('"')? + 1;
    let end = rest[start..].find('"')? + start;
    Some(rest[start..end].to_string())
}

/// Real inventory slot numbering for the /item command family (this is
/// Minecraft's own documented slot-name scheme, distinct from the raw
/// numeric Slot byte in NBT) — main inventory (excluding hotbar) is
/// slot.inventory.0 through slot.inventory.26, which lines up 1:1 with our
/// UI's 27-slot grid.
pub fn ui_slot_to_command_slot(ui_slot: i32) -> String {
    format!("slot.inventory.{ui_slot}")
}
