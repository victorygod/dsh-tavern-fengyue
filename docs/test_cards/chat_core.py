#!/usr/bin/env python3
"""
核心聊天逻辑
只处理与DeepSeek API的交互和聊天历史管理
"""
import json
import os
import requests
import re
from typing import List, Dict, Any, Generator

# 导入存储管理器
from storage_manager import storage_manager


class ChatBot:
    """聊天机器人核心类"""
    
    def __init__(self):
        self.chat_history = []
        self.current_prompt = "default_prompt.json"  # 默认提示词文件
        self.api_key = "sk-fb6fb4d08f7b48989282110d20c09a55"
        self.base_url = "https://api.deepseek.com/v1/chat/completions"
        self.memory_rounds = 6  # 默认记忆轮数
        
        # 加载配置和自动保存
        self.load_config()
        self.load_auto_save()
    
    def load_config(self):
        """加载API密钥配置"""
        config = storage_manager.load_config()
        self.api_key = config.get('api_key', '')
    
    def save_config(self):
        """保存API密钥配置"""
        storage_manager.save_config({'api_key': self.api_key})
    
    def load_prompt(self, prompt_name: str) -> bool:
        """加载提示词配置"""
        try:
            prompt_config = storage_manager.load_prompt(prompt_name)
            if prompt_config:
                self.prompt_config = prompt_config
                self.current_prompt = prompt_name
                return True
            else:
                # 如果加载失败，尝试加载默认提示词
                if prompt_name != "default_prompt.json":
                    return self.load_prompt("default_prompt.json")
                return False
        except Exception as e:
            print(f"加载提示词失败: {str(e)}")
            return False
    
    def get_available_prompts(self) -> List[str]:
        """获取所有可用的提示词"""
        return storage_manager.get_available_prompts()
    
    def build_messages(self, user_input: str) -> List[Dict[str, str]]:
        """构建消息列表，考虑记忆轮数"""
        messages = []

        # 添加系统提示词
        pre_prompt = self.prompt_config.get('pre_prompt', '')
        # world_book trigger
        assistant_region = self.chat_history[-1] if len(self.chat_history) > 0 else ''
        world_book_suffix = self.world_book_trigger(pre_prompt, user_input, assistant_region)
        
        if pre_prompt:
            # 不需要特殊处理，JSON解析时已经正确处理了换行符
            messages.append({
                "role": "system",
                "content": pre_prompt + (('\n' + world_book_suffix['pre_prompt']) if 'pre_prompt' in world_book_suffix else '')
            })
        
        # 添加历史对话（考虑记忆轮数）
        if self.memory_rounds > 0:
            max_messages = self.memory_rounds 
            recent_history = self.chat_history[-max_messages:] if max_messages > 0 else self.chat_history
        else:
            recent_history = []
        
        for msg in recent_history:
            messages.append(msg)
        
        # 添加当前用户输入
        pre_text = self.prompt_config.get('pre_text', '') + (('\n' + world_book_suffix['pre_text']) if 'pre_text' in world_book_suffix else '')
        post_text = self.prompt_config.get('post_text', '') + (('\n' + world_book_suffix['post_text']) if 'post_text' in world_book_suffix else '')
        user_message = f"{pre_text}\n{user_input}\n{post_text}"
        
        messages.append({
            "role": "user",
            "content": user_message
        })
        
        return messages
        
    def stream_chat(self, user_input: str) -> Generator[str, None, None]:
        """流式聊天"""
        if not self.api_key:
            raise Exception("请先设置API密钥")
        
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}"
            }
            
            data = {
                "model": "deepseek-v4-flash",
                "messages": self.build_messages(user_input),
                "stream": True
            }
            
            storage_manager.info_log(self.current_prompt.split('.')[0], data)

            response = requests.post(
                self.base_url,
                headers=headers,
                json=data,
                stream=True,
                timeout=50
            )
            
            if response.status_code != 200:
                error_msg = f"API请求失败: {response.status_code} - {response.text}"
                raise Exception(error_msg)
            
            assistant_response = ""
            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        data_str = line[6:]
                        if data_str == '[DONE]':
                            break
                        try:
                            data_json = json.loads(data_str)
                            if 'choices' in data_json and len(data_json['choices']) > 0:
                                delta = data_json['choices'][0].get('delta', {})
                                if 'content' in delta:
                                    content = delta['content']
                                    assistant_response += content
                                    yield content
                        except json.JSONDecodeError:
                            continue

            # 添加用户消息到历史
            self.chat_history.append({
                "role": "user",
                "content": user_input
            })
            
            # 添加助手回复到历史
            self.chat_history.append({
                "role": "assistant",
                "content": assistant_response
            })
            
            # cg_book trigger
            for cg in self.cg_book_trigger(assistant_response):
                yield cg
            # image_files = self.detect_images_in_response(assistant_response)
            # for image_file in image_files:
            #     yield f"\n[图片: {image_file}]"
            
            # 自动保存
            self.auto_save()
            
        except Exception as e:
            raise Exception(f"聊天失败: {str(e)}")
    
    def cg_book_trigger(self, content):
        cg_configs = self.prompt_config.get('cg_book', [])
        for cg_config in cg_configs:
            if self.check_key(content, cg_config['keys'], cg_config['key_mode']):
                print(f"trigger cg: {cg_config['image_url']}")
                yield f"\n[图片: {cg_config['image_url']}]"
                break

    def check_key(self, content, keys, key_mode):
        if key_mode == 'or':
            for key in keys:
                if key in content:
                    return True
            return False 
        else:
            for key in keys:
                if key not in content:
                    return False 
            return True

    def world_book_trigger(self, system_region, user_input, assistant_region):
        def _parse_region(num, regions): #length = 3
            res = []
            s = 1
            for i in range(3):
                if s & num == s:
                    res.append(regions[i])
                s *= 2
            return res
        world_books = self.prompt_config.get('world_book', [])
        output = {}
        for world_book in world_books:
            r_input = [system_region, user_input, assistant_region]
            key_regions = _parse_region(world_book.get('key_region', 0), r_input)
            content = '\n'.join(list(map(str, key_regions)))
            r_output = ['pre_prompt', 'pre_text', 'post_text']
            value_regions = _parse_region(world_book.get('value_region', 0), r_output)
            segs = world_book['key'].split('_')
            key_mode = segs[1]
            keys = segs[2].split('@wb@')
            if self.check_key(content, keys, key_mode):
                for value_region in value_regions:
                    if value_region not in output:
                        output[value_region] = ""
                    output[value_region] += '\n' + world_book['value']
        storage_manager.info_log(self.current_prompt.split('.')[0], 'world_book trigger result:' + str(output))
        return output

    
    def auto_save(self):
        """自动保存聊天记录"""
        chat_data = {
            "chat_history": self.chat_history,
            "prompt_name": self.current_prompt,
            "memory_rounds": self.memory_rounds
        }
        storage_manager.auto_save(chat_data)
    
    def load_auto_save(self):
        """加载自动保存"""
        chat_data = storage_manager.load_auto_save()
        if chat_data:
            # 从autosave加载数据
            self.chat_history = chat_data.get('chat_history', [])
            self.memory_rounds = chat_data.get('memory_rounds', 6)
            self.load_prompt(chat_data.get('prompt_name', 'default_prompt.json'))
            return True
        else:
            # 如果autosave不存在，使用默认值
            self.load_prompt("default_prompt.json")
            self.memory_rounds = 6
            return False
    
    def clear_chat(self):
        """清空聊天记录"""
        self.chat_history = []
    
    def set_memory_rounds(self, rounds: int):
        """设置记忆轮数"""
        self.memory_rounds = max(0, rounds)